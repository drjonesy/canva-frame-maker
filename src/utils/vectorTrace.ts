import { BinaryImageConverter } from 'vectortracer';
import svgPath from 'svgpath';
import { PathPoint, PointType, Point2D, VectorShape } from '../types';
import { getShapeBounds, sampleCubicBezier } from './bezier';
import { generateShapeId } from './shapePresets';

export interface ImageTraceOptions {
  threshold: number; // 0 to 255
  invert: boolean;
  smoothing: number; // 1 to 10
  detectAlpha: boolean;
  fillHoles: boolean;
}

export interface TraceResult {
  shapes: VectorShape[];
  width: number;
  height: number;
}

/**
 * Reads an SVG's intrinsic pixel size, ignoring percentage widths that some
 * design apps emit ("100%" would otherwise parse as 100px).
 */
function readSvgSize(svgEl: Element): { width: number; height: number } {
  const viewBox = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: Math.round(viewBox[2]), height: Math.round(viewBox[3]) };
  }

  const parseLen = (value: string | null) => {
    if (!value || value.includes('%')) return 0;
    const n = parseFloat(value);
    return isNaN(n) || n <= 0 ? 0 : Math.round(n);
  };

  return {
    width: parseLen(svgEl.getAttribute('width')) || 1080,
    height: parseLen(svgEl.getAttribute('height')) || 1080,
  };
}

/**
 * Produces a raster image source from an SVG that carries no usable vector
 * geometry. Design tools (Affinity, Illustrator) routinely export a placed
 * bitmap wrapped in an <svg>, so prefer the embedded pixels when there is a
 * single data-URI <image>; otherwise render the whole document to a canvas.
 */
export async function svgToRasterSource(svgText: string): Promise<string> {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');

  if (!svgEl || doc.querySelector('parsererror')) {
    throw new Error('Invalid SVG file. No <svg> tag found.');
  }

  const images = Array.from(doc.querySelectorAll('image'));
  if (images.length === 1) {
    const href =
      images[0].getAttribute('href') || images[0].getAttribute('xlink:href') || '';
    if (href.startsWith('data:image/')) return href;
  }

  // Rasterize the document itself. Give the clone an explicit pixel size so the
  // <img> has an intrinsic size even when the source uses percentages.
  const { width, height } = readSvgSize(svgEl);
  const maxDim = 2048;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const clone = svgEl.cloneNode(true) as Element;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);

  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not render SVG to an image.'));
      i.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create 2D canvas context');

    ctx.drawImage(img, 0, 0, outW, outH);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Elements that define reusable content rather than drawing anything. */
const NON_RENDERED_TAGS = new Set([
  'defs',
  'clippath',
  'mask',
  'marker',
  'pattern',
  'symbol',
]);

const GEOMETRY_TAGS = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'line',
]);

const IMPORT_STYLE = {
  fillColor: '#6366f1',
  strokeColor: '#4338ca',
  strokeWidth: 0,
  opacity: 1,
  visible: true,
  locked: false,
  isFrameCandidate: true,
};

/**
 * Expresses a primitive element (rect, circle, …) as path data so that every
 * shape can go through the same normalisation.
 */
function elementToPathData(el: Element): string | null {
  const num = (name: string, fallback = 0) => {
    const v = parseFloat(el.getAttribute(name) || '');
    return isNaN(v) ? fallback : v;
  };

  switch (el.tagName.toLowerCase()) {
    case 'path':
      return el.getAttribute('d');

    case 'rect': {
      const x = num('x');
      const y = num('y');
      const w = num('width');
      const h = num('height');
      if (w <= 0 || h <= 0) return null;

      // Per spec a missing rx/ry mirrors the other, and both clamp to half the side.
      const hasRx = el.hasAttribute('rx');
      const hasRy = el.hasAttribute('ry');
      let rx = hasRx ? num('rx') : hasRy ? num('ry') : 0;
      let ry = hasRy ? num('ry') : hasRx ? num('rx') : 0;
      rx = Math.min(Math.max(rx, 0), w / 2);
      ry = Math.min(Math.max(ry, 0), h / 2);

      if (rx === 0 || ry === 0) {
        return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
      }
      return (
        `M ${x + rx} ${y} H ${x + w - rx}` +
        ` A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} V ${y + h - ry}` +
        ` A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} H ${x + rx}` +
        ` A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} V ${y + ry}` +
        ` A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`
      );
    }

    case 'circle':
    case 'ellipse': {
      const isCircle = el.tagName.toLowerCase() === 'circle';
      const rx = isCircle ? num('r') : num('rx');
      const ry = isCircle ? num('r') : num('ry');
      if (rx <= 0 || ry <= 0) return null;
      const cx = num('cx');
      const cy = num('cy');
      // Two half arcs; svgpath turns them into cubics.
      return (
        `M ${cx - rx} ${cy}` +
        ` A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy}` +
        ` A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
      );
    }

    case 'polygon':
    case 'polyline': {
      const nums = (el.getAttribute('points') || '').match(
        /[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g
      );
      if (!nums || nums.length < 4) return null;
      let d = `M ${nums[0]} ${nums[1]}`;
      for (let i = 2; i + 1 < nums.length; i += 2) {
        d += ` L ${nums[i]} ${nums[i + 1]}`;
      }
      return el.tagName.toLowerCase() === 'polygon' ? `${d} Z` : d;
    }

    case 'line':
      return `M ${num('x1')} ${num('y1')} L ${num('x2')} ${num('y2')}`;

    default:
      return null;
  }
}

/**
 * Resolves an id reference without building a selector out of file content.
 */
function findById(root: Element, id: string): Element | null {
  const candidates = root.querySelectorAll('[id]');
  for (const el of Array.from(candidates)) {
    if (el.getAttribute('id') === id) return el;
  }
  return null;
}

interface Drawable {
  el: Element;
  transform: string;
  name: string;
}

/**
 * Walks the rendered tree, accumulating each element's transform chain and
 * expanding <use> references. Ignoring transforms — as a naive querySelectorAll
 * does — silently misplaces every shape an editor nested inside a <g>.
 */
function collectDrawables(root: Element, baseTransform: string): Drawable[] {
  const out: Drawable[] = [];

  const visit = (node: Element, inherited: string, chain: Set<Element>) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (NON_RENDERED_TAGS.has(tag)) continue;
      if (child.getAttribute('display') === 'none') continue;

      const own = child.getAttribute('transform');
      const combined = own ? `${inherited} ${own}`.trim() : inherited;

      if (GEOMETRY_TAGS.has(tag)) {
        out.push({
          el: child,
          transform: combined,
          name: child.getAttribute('id') || `SVG_${tag.toUpperCase()}_${out.length + 1}`,
        });
        continue;
      }

      if (tag === 'use') {
        const href =
          child.getAttribute('href') || child.getAttribute('xlink:href') || '';
        if (!href.startsWith('#')) continue;

        const target = findById(root, href.slice(1));
        // A <use> pointing at itself or at an ancestor would recurse forever.
        if (!target || chain.has(target)) continue;

        const ux = parseFloat(child.getAttribute('x') || '0') || 0;
        const uy = parseFloat(child.getAttribute('y') || '0') || 0;
        const useTransform =
          ux || uy ? `${combined} translate(${ux} ${uy})`.trim() : combined;

        const nextChain = new Set(chain);
        nextChain.add(target);

        const targetTag = target.tagName.toLowerCase();
        const targetOwn = target.getAttribute('transform');
        const targetTransform = targetOwn
          ? `${useTransform} ${targetOwn}`.trim()
          : useTransform;

        if (GEOMETRY_TAGS.has(targetTag)) {
          out.push({
            el: target,
            transform: targetTransform,
            name:
              child.getAttribute('id') ||
              target.getAttribute('id') ||
              `SVG_USE_${out.length + 1}`,
          });
        } else {
          visit(target, targetTransform, nextChain);
        }
        continue;
      }

      visit(child, combined, chain);
    }
  };

  visit(root, baseTransform, new Set([root]));
  return out;
}

/** Handles within this angle of each other read as one smooth tangent. */
const SMOOTH_TOLERANCE_DEG = 8;

/**
 * Marks each anchor as a corner or a smooth point.
 *
 * Parsing only reveals that a segment is curved, not whether the curve carries
 * smoothly through the anchor. Calling every curved anchor 'rounded' tells the
 * editor to hold its handles collinear, which rounds off genuine corners as
 * soon as they are edited — so compare the tangents and only claim 'rounded'
 * when they actually line up.
 */
function classifyPointTypes(points: PathPoint[], closed: boolean): void {
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p = points[i];

    if (!p.cp1 && !p.cp2) {
      p.type = 'straight';
      continue;
    }

    const prev = closed ? points[(i - 1 + n) % n] : points[i - 1];
    const next = closed ? points[(i + 1) % n] : points[i + 1];
    const inRef = p.cp1 || prev;
    const outRef = p.cp2 || next;

    // An open path's endpoints have a handle on one side only: a corner.
    if (!inRef || !outRef) {
      p.type = 'break';
      continue;
    }

    const inX = p.x - inRef.x;
    const inY = p.y - inRef.y;
    const outX = outRef.x - p.x;
    const outY = outRef.y - p.y;
    const inLen = Math.hypot(inX, inY);
    const outLen = Math.hypot(outX, outY);

    if (inLen < 1e-9 || outLen < 1e-9) {
      p.type = 'break';
      continue;
    }

    const cos = (inX * outX + inY * outY) / (inLen * outLen);
    const angle = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
    p.type = angle <= SMOOTH_TOLERANCE_DEG ? 'rounded' : 'break';
  }
}

/**
 * Converts normalised (absolute, arc-free, shorthand-free) path data into the
 * editor's point model, splitting sub-paths so compound shapes keep their holes.
 */
function pathDataToShape(
  d: string,
  transform: string,
  name: string
): VectorShape | null {
  let normalized: ReturnType<typeof svgPath>;
  try {
    let p = svgPath(d);
    if (transform) p = p.transform(transform);
    normalized = p.unshort().unarc().abs();
  } catch {
    return null;
  }

  const id = generateShapeId();
  let counter = 0;
  const mk = (x: number, y: number, type: PointType): PathPoint => ({
    id: `${id}_p${counter++}`,
    x,
    y,
    type,
  });

  const subPaths: PathPoint[][] = [];
  const closedFlags: boolean[] = [];
  let current: PathPoint[] = [];
  let currentClosed = false;

  const flush = () => {
    if (current.length >= 2) {
      // A closing segment usually restates the first point; fold it back in so
      // the handle survives without leaving a duplicate anchor behind.
      const first = current[0];
      const last = current[current.length - 1];
      if (
        current.length > 2 &&
        Math.abs(first.x - last.x) < 1e-6 &&
        Math.abs(first.y - last.y) < 1e-6
      ) {
        if (last.cp1) first.cp1 = last.cp1;
        if (last.cp1 && first.type === 'straight') first.type = 'rounded';
        current.pop();
      }
      subPaths.push(current);
      closedFlags.push(currentClosed);
    }
    current = [];
    currentClosed = false;
  };

  const attachOutgoing = (cp: Point2D) => {
    const prev = current[current.length - 1];
    if (!prev) return;
    prev.cp2 = cp;
    if (prev.type === 'straight') prev.type = 'rounded';
  };

  normalized.iterate((seg, _index, x, y) => {
    switch (seg[0]) {
      case 'M':
        flush();
        current.push(mk(seg[1], seg[2], 'straight'));
        break;
      case 'L':
        current.push(mk(seg[1], seg[2], 'straight'));
        break;
      case 'H':
        current.push(mk(seg[1], y, 'straight'));
        break;
      case 'V':
        current.push(mk(x, seg[1], 'straight'));
        break;
      case 'C': {
        attachOutgoing({ x: seg[1], y: seg[2] });
        const pt = mk(seg[5], seg[6], 'rounded');
        pt.cp1 = { x: seg[3], y: seg[4] };
        current.push(pt);
        break;
      }
      case 'Q': {
        // Raise the quadratic to a cubic: the editor only models cubics.
        const prev = current[current.length - 1];
        const px = prev ? prev.x : x;
        const py = prev ? prev.y : y;
        attachOutgoing({
          x: px + (2 / 3) * (seg[1] - px),
          y: py + (2 / 3) * (seg[2] - py),
        });
        const pt = mk(seg[3], seg[4], 'rounded');
        pt.cp1 = {
          x: seg[3] + (2 / 3) * (seg[1] - seg[3]),
          y: seg[4] + (2 / 3) * (seg[2] - seg[4]),
        };
        current.push(pt);
        break;
      }
      case 'Z':
      case 'z':
        currentClosed = true;
        flush();
        break;
    }
  });
  flush();

  if (subPaths.length === 0) return null;

  subPaths.forEach((sub, i) => classifyPointTypes(sub, closedFlags[i] ?? true));

  return {
    id,
    name,
    points: subPaths[0],
    closed: closedFlags[0] ?? true,
    ...IMPORT_STYLE,
    ...(subPaths.length > 1 ? { subPaths: subPaths.slice(1) } : {}),
  };
}

/**
 * Parses an SVG string, extracting dimensions and converting vector elements into VectorShape
 */
export function parseSvgToVectorShapes(svgText: string): TraceResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');

  if (!svgEl || doc.querySelector('parsererror')) {
    throw new Error('Invalid SVG file. No <svg> tag found.');
  }

  // Extract dimensions
  let width = 1080;
  let height = 1080;
  let baseTransform = '';

  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      width = Math.round(parts[2]);
      height = Math.round(parts[3]);
      // A viewBox origin shifts every coordinate in the document.
      if (parts[0] !== 0 || parts[1] !== 0) {
        baseTransform = `translate(${-parts[0]} ${-parts[1]})`;
      }
    }
  } else {
    const wAttr = parseFloat(svgEl.getAttribute('width') || '');
    const hAttr = parseFloat(svgEl.getAttribute('height') || '');
    if (!isNaN(wAttr) && wAttr > 0) width = Math.round(wAttr);
    if (!isNaN(hAttr) && hAttr > 0) height = Math.round(hAttr);
  }

  const shapes: VectorShape[] = [];

  for (const drawable of collectDrawables(svgEl, baseTransform)) {
    const d = elementToPathData(drawable.el);
    if (!d) continue;
    const shape = pathDataToShape(d, drawable.transform, drawable.name);
    if (shape) shapes.push(shape);
  }

  return { shapes, width, height };
}

/** A traced segment flatter than this many pixels is really a straight line. */
const FLATNESS_TOLERANCE = 0.8;
/** Two line segments meeting at less of a turn than this are one line. */
const COLLINEAR_TOLERANCE_DEG = 2.5;

/**
 * vtracer fits a spline through the whole contour, so a straight edge comes
 * back as a chain of barely-curved segments — which reads as a rounded shape
 * with far too many anchors. Flatten the segments that are already straight to
 * within a pixel, then drop the anchors left sitting mid-line.
 *
 * This only removes what is provably redundant, so the outline does not move.
 */
function straightenFlatRuns(points: PathPoint[], closed: boolean): PathPoint[] {
  const n = points.length;
  if (n < 3) return points;

  const pts = points.map((p) => ({
    ...p,
    cp1: p.cp1 ? { ...p.cp1 } : undefined,
    cp2: p.cp2 ? { ...p.cp2 } : undefined,
  }));

  const lastSeg = closed ? n - 1 : n - 2;
  for (let i = 0; i <= lastSeg; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    if (!a.cp2 && !b.cp1) continue;

    const chordX = b.x - a.x;
    const chordY = b.y - a.y;
    const chordLen = Math.hypot(chordX, chordY);
    if (chordLen < 1e-9) continue;

    let worst = 0;
    for (const [sx, sy] of sampleCubicBezier(a, a.cp2 || a, b.cp1 || b, b, 10)) {
      // Perpendicular distance from the sample to the chord.
      const d = Math.abs(chordX * (a.y - sy) - (a.x - sx) * chordY) / chordLen;
      if (d > worst) worst = d;
    }

    if (worst <= FLATNESS_TOLERANCE) {
      a.cp2 = undefined;
      b.cp1 = undefined;
    }
  }

  // Anchors between two straight segments that barely turn add nothing.
  const keep: PathPoint[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const isEndpoint = !closed && (i === 0 || i === pts.length - 1);
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];

    if (isEndpoint || p.cp1 || p.cp2 || prev.cp2 || next.cp1) {
      keep.push(p);
      continue;
    }

    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y);
    const outLen = Math.hypot(next.x - p.x, next.y - p.y);
    if (inLen < 1e-9 || outLen < 1e-9) continue; // duplicate anchor

    const cos =
      ((p.x - prev.x) * (next.x - p.x) + (p.y - prev.y) * (next.y - p.y)) /
      (inLen * outLen);
    const turn = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
    if (turn > COLLINEAR_TOLERANCE_DEG) keep.push(p);
  }

  return keep.length >= (closed ? 3 : 2) ? keep : pts;
}

/**
 * Maps the UI's single "smoothing" dial onto vtracer's curve-fitting knobs.
 * Higher smoothing means blunter corners, longer segments and more aggressive
 * speckle removal.
 */
function converterParamsFor(smoothing: number) {
  const s = Math.min(12, Math.max(1, smoothing));
  return {
    debug: false,
    mode: 'spline' as const,
    // vtracer wants radians. 50° at the low end up to 105° at the high end:
    // the wider the angle, the fewer points survive as hard corners.
    cornerThreshold: ((45 + s * 5) * Math.PI) / 180,
    lengthThreshold: 2 + s * 0.5,
    maxIterations: 10,
    spliceThreshold: (45 * Math.PI) / 180,
    // Cluster sizes are pixel areas, so grow the speckle floor quadratically.
    filterSpeckle: Math.max(4, s * s),
    pathPrecision: 8,
  };
}

/**
 * Outline/Trace a raster image (PNG, JPG, WEBP) into vector paths.
 *
 * Contour extraction and curve fitting are done by vtracer (visioncortex) in
 * WebAssembly. It binarises on the red channel at a fixed midpoint and ignores
 * alpha, so the threshold / alpha / invert decisions stay here and it receives
 * an already black-and-white image.
 */
export async function traceRasterImage(
  imageSource: HTMLImageElement | string,
  options: Partial<ImageTraceOptions> = {}
): Promise<TraceResult> {
  const opts: ImageTraceOptions = {
    threshold: 128,
    invert: false,
    smoothing: 4,
    detectAlpha: true,
    fillHoles: true,
    ...options,
  };

  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    if (typeof imageSource === 'string') {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = imageSource;
    } else {
      if (imageSource.complete) resolve(imageSource);
      else {
        imageSource.onload = () => resolve(imageSource);
        imageSource.onerror = reject;
      }
    }
  });

  const width = img.naturalWidth || img.width || 800;
  const height = img.naturalHeight || img.height || 800;

  // Render to offscreen canvas. Tracing runs in wasm so a larger working
  // resolution is affordable, which keeps small details intact.
  const canvas = document.createElement('canvas');
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const procW = Math.max(20, Math.round(width * scale));
  const procH = Math.max(20, Math.round(height * scale));

  canvas.width = procW;
  canvas.height = procH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D canvas context');

  ctx.drawImage(img, 0, 0, procW, procH);
  const imgData = ctx.getImageData(0, 0, procW, procH);
  const data = imgData.data;

  // Determine if image has alpha transparency
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 240) {
      hasAlpha = true;
      break;
    }
  }

  // Flatten to pure black (inside the frame) on white (background).
  for (let i = 0; i < data.length; i += 4) {
    let isForeground: boolean;
    if (hasAlpha && opts.detectAlpha) {
      isForeground = data[i + 3] >= opts.threshold;
    } else {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      isForeground = lum < opts.threshold;
    }
    if (opts.invert) isForeground = !isForeground;

    const v = isForeground ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  let svgOutput = '';
  const converter = new BinaryImageConverter(
    imgData,
    converterParamsFor(opts.smoothing),
    { invert: false, pathFill: undefined, backgroundColor: undefined, attributes: undefined, scale: 1 }
  );
  try {
    converter.init();
    // tick() walks one cluster per call and reports true once they are all done.
    let guard = 0;
    while (!converter.tick()) {
      if (++guard > procW * procH) break;
    }
    svgOutput = converter.getResult();
  } finally {
    converter.free();
  }

  const traced = parseSvgToVectorShapes(svgOutput).shapes.map((shape) => {
    const points = straightenFlatRuns(shape.points, true);
    const subPaths = shape.subPaths?.map((sub) => straightenFlatRuns(sub, true));
    classifyPointTypes(points, true);
    subPaths?.forEach((sub) => classifyPointTypes(sub, true));
    return { ...shape, points, subPaths };
  });

  // vtracer works in the processed pixel grid; map back to the source size.
  const invScale = 1 / scale;
  const rescale = (p: PathPoint): PathPoint => ({
    ...p,
    x: Math.round(p.x * invScale * 100) / 100,
    y: Math.round(p.y * invScale * 100) / 100,
    cp1: p.cp1
      ? { x: p.cp1.x * invScale, y: p.cp1.y * invScale }
      : undefined,
    cp2: p.cp2
      ? { x: p.cp2.x * invScale, y: p.cp2.y * invScale }
      : undefined,
  });

  const shapes: VectorShape[] = traced.map((shape, idx) => ({
    ...shape,
    name: idx === 0 ? 'Image Frame Outline' : `Image Frame Outline ${idx + 1}`,
    points: shape.points.map(rescale),
    // fillHoles keeps only the outer contour of each cluster.
    subPaths:
      opts.fillHoles || !shape.subPaths
        ? undefined
        : shape.subPaths.map((sub) => sub.map(rescale)),
    closed: true,
    fillColor: '#6366f1',
    strokeColor: '#4338ca',
    strokeWidth: 0,
    opacity: 1,
    visible: true,
    locked: false,
    isFrameCandidate: true,
  }));

  // Largest first, so the primary silhouette is the one selected on import.
  shapes.sort((a, b) => {
    const area = (s: VectorShape) => {
      const b1 = getShapeBounds(s);
      return b1.width * b1.height;
    };
    return area(b) - area(a);
  });

  if (shapes.length === 0) {
    // Fallback if empty: standard center frame outline
    const id = generateShapeId();
    const fallbackShape: VectorShape = {
      id,
      name: 'Image Frame Outline',
      points: [
        { id: `${id}_p0`, x: width * 0.1, y: height * 0.1, type: 'straight' },
        { id: `${id}_p1`, x: width * 0.9, y: height * 0.1, type: 'straight' },
        { id: `${id}_p2`, x: width * 0.9, y: height * 0.9, type: 'straight' },
        { id: `${id}_p3`, x: width * 0.1, y: height * 0.9, type: 'straight' },
      ],
      closed: true,
      fillColor: '#6366f1',
      strokeColor: '#4338ca',
      strokeWidth: 0,
      opacity: 1,
      visible: true,
      locked: false,
      isFrameCandidate: true,
    };
    return { shapes: [fallbackShape], width, height };
  }

  return { shapes, width, height };
}
