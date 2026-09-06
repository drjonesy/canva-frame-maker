import { PathPoint, Point2D, VectorShape } from '../types';
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
 * Parses an SVG string, extracting dimensions and converting vector elements into VectorShape
 */
export function parseSvgToVectorShapes(svgText: string): TraceResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');

  if (!svgEl) {
    throw new Error('Invalid SVG file. No <svg> tag found.');
  }

  // Extract dimensions
  let width = 1080;
  let height = 1080;

  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      width = Math.round(parts[2]);
      height = Math.round(parts[3]);
    }
  } else {
    const wAttr = parseFloat(svgEl.getAttribute('width') || '');
    const hAttr = parseFloat(svgEl.getAttribute('height') || '');
    if (!isNaN(wAttr) && wAttr > 0) width = Math.round(wAttr);
    if (!isNaN(hAttr) && hAttr > 0) height = Math.round(hAttr);
  }

  const shapes: VectorShape[] = [];

  // Helper to parse path 'd' attribute
  function parsePathD(d: string, name: string): VectorShape | null {
    const pathCommands = d.match(/([a-df-z])([^a-df-z]*)/gi);
    if (!pathCommands) return null;

    const points: PathPoint[] = [];
    const id = generateShapeId();
    let currX = 0;
    let currY = 0;
    let startX = 0;
    let startY = 0;
    let closed = false;

    for (const cmd of pathCommands) {
      const type = cmd[0];
      const numbers = (cmd.slice(1).match(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || []).map(
        Number
      );

      switch (type) {
        case 'M': {
          if (numbers.length >= 2) {
            currX = numbers[0];
            currY = numbers[1];
            startX = currX;
            startY = currY;
            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              type: 'straight',
            });
          }
          break;
        }
        case 'm': {
          if (numbers.length >= 2) {
            currX += numbers[0];
            currY += numbers[1];
            startX = currX;
            startY = currY;
            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              type: 'straight',
            });
          }
          break;
        }
        case 'L': {
          for (let i = 0; i < numbers.length; i += 2) {
            currX = numbers[i];
            currY = numbers[i + 1];
            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              type: 'straight',
            });
          }
          break;
        }
        case 'l': {
          for (let i = 0; i < numbers.length; i += 2) {
            currX += numbers[i];
            currY += numbers[i + 1];
            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              type: 'straight',
            });
          }
          break;
        }
        case 'H': {
          for (let i = 0; i < numbers.length; i++) {
            currX = numbers[i];
            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              type: 'straight',
            });
          }
          break;
        }
        case 'h': {
          for (let i = 0; i < numbers.length; i++) {
            currX += numbers[i];
            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              type: 'straight',
            });
          }
          break;
        }
        case 'V': {
          for (let i = 0; i < numbers.length; i++) {
            currY = numbers[i];
            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              type: 'straight',
            });
          }
          break;
        }
        case 'v': {
          for (let i = 0; i < numbers.length; i++) {
            currY += numbers[i];
            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              type: 'straight',
            });
          }
          break;
        }
        case 'C': {
          for (let i = 0; i < numbers.length; i += 6) {
            const cp1x = numbers[i];
            const cp1y = numbers[i + 1];
            const cp2x = numbers[i + 2];
            const cp2y = numbers[i + 3];
            currX = numbers[i + 4];
            currY = numbers[i + 5];

            // Set outgoing handle on previous point
            if (points.length > 0) {
              const prev = points[points.length - 1];
              prev.cp2 = { x: cp1x, y: cp1y };
              prev.type = 'rounded';
            }

            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              cp1: { x: cp2x, y: cp2y },
              type: 'rounded',
            });
          }
          break;
        }
        case 'c': {
          for (let i = 0; i < numbers.length; i += 6) {
            const cp1x = currX + numbers[i];
            const cp1y = currY + numbers[i + 1];
            const cp2x = currX + numbers[i + 2];
            const cp2y = currY + numbers[i + 3];
            currX += numbers[i + 4];
            currY += numbers[i + 5];

            if (points.length > 0) {
              const prev = points[points.length - 1];
              prev.cp2 = { x: cp1x, y: cp1y };
              prev.type = 'rounded';
            }

            points.push({
              id: `${id}_p${points.length}`,
              x: currX,
              y: currY,
              cp1: { x: cp2x, y: cp2y },
              type: 'rounded',
            });
          }
          break;
        }
        case 'Z':
        case 'z': {
          closed = true;
          currX = startX;
          currY = startY;
          break;
        }
      }
    }

    if (points.length < 2) return null;

    return {
      id,
      name,
      points,
      closed: true,
      fillColor: '#6366f1',
      strokeColor: '#4338ca',
      strokeWidth: 2,
      opacity: 1,
      visible: true,
      locked: false,
      isFrameCandidate: true,
    };
  }

  // Traverse all elements in SVG
  const allElements = svgEl.querySelectorAll(
    'path, rect, circle, ellipse, polygon, polyline'
  );

  allElements.forEach((el, idx) => {
    const tagName = el.tagName.toLowerCase();
    const name = el.getAttribute('id') || `SVG_${tagName.toUpperCase()}_${idx + 1}`;

    if (tagName === 'path') {
      const d = el.getAttribute('d');
      if (d) {
        const shape = parsePathD(d, name);
        if (shape) shapes.push(shape);
      }
    } else if (tagName === 'rect') {
      const x = parseFloat(el.getAttribute('x') || '0');
      const y = parseFloat(el.getAttribute('y') || '0');
      const w = parseFloat(el.getAttribute('width') || '100');
      const h = parseFloat(el.getAttribute('height') || '100');
      const rx = parseFloat(el.getAttribute('rx') || '0');
      const id = generateShapeId();

      if (rx > 0) {
        // approximate rounded rect
        shapes.push({
          id,
          name,
          points: [
            { id: `${id}_p0`, x: x + rx, y, type: 'straight' },
            { id: `${id}_p1`, x: x + w - rx, y, type: 'straight' },
            { id: `${id}_p2`, x: x + w, y: y + rx, type: 'straight' },
            { id: `${id}_p3`, x: x + w, y: y + h - rx, type: 'straight' },
            { id: `${id}_p4`, x: x + w - rx, y: y + h, type: 'straight' },
            { id: `${id}_p5`, x: x + rx, y: y + h, type: 'straight' },
            { id: `${id}_p6`, x, y: y + h - rx, type: 'straight' },
            { id: `${id}_p7`, x, y: y + rx, type: 'straight' },
          ],
          closed: true,
          fillColor: '#6366f1',
          strokeColor: '#4338ca',
          strokeWidth: 2,
          opacity: 1,
          visible: true,
          locked: false,
          isFrameCandidate: true,
        });
      } else {
        shapes.push({
          id,
          name,
          points: [
            { id: `${id}_p0`, x, y, type: 'straight' },
            { id: `${id}_p1`, x: x + w, y, type: 'straight' },
            { id: `${id}_p2`, x: x + w, y: y + h, type: 'straight' },
            { id: `${id}_p3`, x, y: y + h, type: 'straight' },
          ],
          closed: true,
          fillColor: '#6366f1',
          strokeColor: '#4338ca',
          strokeWidth: 2,
          opacity: 1,
          visible: true,
          locked: false,
          isFrameCandidate: true,
        });
      }
    } else if (tagName === 'circle' || tagName === 'ellipse') {
      const cx = parseFloat(el.getAttribute('cx') || '50');
      const cy = parseFloat(el.getAttribute('cy') || '50');
      const rx = parseFloat(
        el.getAttribute('rx') || el.getAttribute('r') || '50'
      );
      const ry = parseFloat(
        el.getAttribute('ry') || el.getAttribute('r') || '50'
      );
      const kx = rx * 0.5522847;
      const ky = ry * 0.5522847;
      const id = generateShapeId();

      shapes.push({
        id,
        name,
        points: [
          {
            id: `${id}_p0`,
            x: cx,
            y: cy - ry,
            type: 'rounded',
            cp1: { x: cx - kx, y: cy - ry },
            cp2: { x: cx + kx, y: cy - ry },
          },
          {
            id: `${id}_p1`,
            x: cx + rx,
            y: cy,
            type: 'rounded',
            cp1: { x: cx + rx, y: cy - ky },
            cp2: { x: cx + rx, y: cy + ky },
          },
          {
            id: `${id}_p2`,
            x: cx,
            y: cy + ry,
            type: 'rounded',
            cp1: { x: cx + kx, y: cy + ry },
            cp2: { x: cx - kx, y: cy + ry },
          },
          {
            id: `${id}_p3`,
            x: cx - rx,
            y: cy,
            type: 'rounded',
            cp1: { x: cx - rx, y: cy + ky },
            cp2: { x: cx - rx, y: cy - ky },
          },
        ],
        closed: true,
        fillColor: '#6366f1',
        strokeColor: '#4338ca',
        strokeWidth: 2,
        opacity: 1,
        visible: true,
        locked: false,
        isFrameCandidate: true,
      });
    } else if (tagName === 'polygon' || tagName === 'polyline') {
      const ptsAttr = el.getAttribute('points') || '';
      const numbers = (ptsAttr.match(/[-+]?(?:\d*\.\d+|\d+)/g) || []).map(Number);
      const id = generateShapeId();
      const points: PathPoint[] = [];

      for (let i = 0; i < numbers.length; i += 2) {
        points.push({
          id: `${id}_p${points.length}`,
          x: numbers[i],
          y: numbers[i + 1],
          type: 'straight',
        });
      }

      if (points.length >= 3) {
        shapes.push({
          id,
          name,
          points,
          closed: true,
          fillColor: '#6366f1',
          strokeColor: '#4338ca',
          strokeWidth: 2,
          opacity: 1,
          visible: true,
          locked: false,
          isFrameCandidate: true,
        });
      }
    }
  });

  return { shapes, width, height };
}

/**
 * Douglas-Peucker point simplification algorithm
 */
function douglasPeucker(points: Point2D[], epsilon: number): Point2D[] {
  if (points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const recResults2 = douglasPeucker(points.slice(index), epsilon);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

function perpendicularDistance(pt: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  let dx = lineEnd.x - lineStart.x;
  let dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);

  const u = ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / (mag * mag);
  let ix: number;
  let iy: number;
  if (u < 0) {
    ix = lineStart.x;
    iy = lineStart.y;
  } else if (u > 1) {
    ix = lineEnd.x;
    iy = lineEnd.y;
  } else {
    ix = lineStart.x + u * dx;
    iy = lineStart.y + u * dy;
  }
  return Math.hypot(pt.x - ix, pt.y - iy);
}

/**
 * Outline/Trace a raster image (PNG, JPG, WEBP) into vector paths
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

  // Render to offscreen canvas
  const canvas = document.createElement('canvas');
  // Limit processing resolution for quick response while keeping sharp contours
  const maxDim = 800;
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

  // Create binary grid (true = inside frame, false = background)
  const grid: boolean[] = new Array(procW * procH);

  for (let y = 0; y < procH; y++) {
    for (let x = 0; x < procW; x++) {
      const idx = (y * procW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      let isForeground = false;
      if (hasAlpha && opts.detectAlpha) {
        isForeground = a >= opts.threshold;
      } else {
        // Luminance calculation
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        isForeground = lum < opts.threshold; // dark on light or contrast
      }

      if (opts.invert) {
        isForeground = !isForeground;
      }

      grid[y * procW + x] = isForeground;
    }
  }

  // Find exterior boundary using Moore-Neighbor / Marching Squares
  const rawContour = traceOuterContour(grid, procW, procH);

  if (rawContour.length < 3) {
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
      strokeWidth: 2,
      opacity: 1,
      visible: true,
      locked: false,
      isFrameCandidate: true,
    };
    return { shapes: [fallbackShape], width, height };
  }

  // Scale raw contour back to original image dimensions
  const invScale = 1 / scale;
  const scaledPoints: Point2D[] = rawContour.map((p) => ({
    x: Math.round(p.x * invScale),
    y: Math.round(p.y * invScale),
  }));

  // Simplify using Douglas-Peucker
  const epsilon = Math.max(1, opts.smoothing * 1.2);
  const simplified = douglasPeucker(scaledPoints, epsilon);

  // Convert to PathPoints with smooth Bézier curve handles
  const id = generateShapeId();
  const pathPoints: PathPoint[] = [];

  for (let i = 0; i < simplified.length; i++) {
    const curr = simplified[i];
    const prev = simplified[(i - 1 + simplified.length) % simplified.length];
    const next = simplified[(i + 1) % simplified.length];

    // Compute tangent vector for smooth curvature
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const handleDist = Math.min(len * 0.25, 30);

    const cp1 = {
      x: curr.x - (dx / len) * handleDist,
      y: curr.y - (dy / len) * handleDist,
    };
    const cp2 = {
      x: curr.x + (dx / len) * handleDist,
      y: curr.y + (dy / len) * handleDist,
    };

    pathPoints.push({
      id: `${id}_p${i}`,
      x: curr.x,
      y: curr.y,
      cp1,
      cp2,
      type: 'rounded',
    });
  }

  const resultShape: VectorShape = {
    id,
    name: 'Image Frame Outline',
    points: pathPoints,
    closed: true,
    fillColor: '#6366f1',
    strokeColor: '#4338ca',
    strokeWidth: 2,
    opacity: 1,
    visible: true,
    locked: false,
    isFrameCandidate: true,
  };

  return { shapes: [resultShape], width, height };
}

/**
 * Traces the outermost contour of a binary grid
 */
function traceOuterContour(grid: boolean[], w: number, h: number): Point2D[] {
  // Find top-most left-most foreground pixel
  let startX = -1;
  let startY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y * w + x]) {
        startX = x;
        startY = y;
        break;
      }
    }
    if (startX !== -1) break;
  }

  if (startX === -1) return [];

  // Moore-Neighbor Tracing
  const contour: Point2D[] = [];
  let currX = startX;
  let currY = startY;

  // Directions (Clockwise 8-neighborhood)
  // 0: N, 1: NE, 2: E, 3: SE, 4: S, 5: SW, 6: W, 7: NW
  const dx = [0, 1, 1, 1, 0, -1, -1, -1];
  const dy = [-1, -1, 0, 1, 1, 1, 0, -1];

  let dir = 7; // Backtrack direction
  contour.push({ x: currX, y: currY });

  const maxSteps = w * h;
  let step = 0;

  while (step++ < maxSteps) {
    let found = false;
    // Check neighbor starting from (dir + 5) % 8 (backtrack relative)
    const checkStart = (dir + 5) % 8;

    for (let i = 0; i < 8; i++) {
      const d = (checkStart + i) % 8;
      const nx = currX + dx[d];
      const ny = currY + dy[d];

      if (nx >= 0 && nx < w && ny >= 0 && ny < h && grid[ny * w + nx]) {
        currX = nx;
        currY = ny;
        dir = d;
        found = true;
        break;
      }
    }

    if (!found) break;

    // Returned to start point
    if (currX === startX && currY === startY) {
      break;
    }

    contour.push({ x: currX, y: currY });
  }

  return contour;
}
