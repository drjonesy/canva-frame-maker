import polygonClipping, { MultiPolygon, Ring } from 'polygon-clipping';
import type { Font, PathCommand } from 'opentype.js';
import { PathPoint, Point2D, TextStyle, VectorShape } from '../types';
import { polygonToPathPoints } from './booleanOps';
import { SourceIndex } from './pathClipping';
import { samplePathToPolygon } from './bezier';
import { generateShapeId } from './shapePresets';

/**
 * Turning a `TextStyle` into the bezier geometry the rest of the app already
 * knows how to move, align, export and save.
 *
 * A text layer is an ordinary `VectorShape` — its outlines are real anchors and
 * handles, so selection, rotation, the boolean ops, the size check and the
 * Canva export all work on it with no special case. What makes it *editable* is
 * the `text` descriptor riding alongside: the geometry is rebuilt from it every
 * time a font setting changes, so the anchors are a derived view rather than
 * the source of truth. Anything that edits those anchors directly therefore has
 * to `detachText` first, or the next font change would silently discard the
 * edit.
 */

/** Layout constants that have no business being settings. */
const DECORATION_FALLBACK_THICKNESS = 0.06; // of the em size
const DECORATION_FALLBACK_UNDERLINE = -0.12; // of the em size, below baseline

/** How straight two handles have to be to call an anchor smooth. */
const COLLINEAR_EPSILON = 1e-3;

/** Steps per curve when sampling only to ask "do these two outlines cross?". */
const OVERLAP_SAMPLES = 6;

export const DEFAULT_TEXT_STYLE: Omit<TextStyle, 'x' | 'y'> = {
  content: 'Type here',
  fontFamily: 'Inter',
  fontSize: 160,
  bold: false,
  italic: false,
  letterSpacing: 0,
  lineHeight: 1.2,
  underline: false,
  overline: false,
  lineThrough: false,
};

/* ------------------------------------------------------------------ */
/* Glyph outlines → PathPoints                                         */
/* ------------------------------------------------------------------ */

function collinear(a: Point2D, b: Point2D, origin: Point2D): boolean {
  const ax = a.x - origin.x;
  const ay = a.y - origin.y;
  const bx = b.x - origin.x;
  const by = b.y - origin.y;
  const scale = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (scale === 0) return false;
  return Math.abs(ax * by - ay * bx) / scale < COLLINEAR_EPSILON;
}

/**
 * Give an anchor the type its handles say it is — the same rule the boolean
 * ops re-derive types by, so a glyph's corners stay corners when they are
 * dragged and its curves stay smooth.
 */
function typeFromHandles(p: PathPoint): PathPoint {
  if (!p.cp1 && !p.cp2) return { ...p, type: 'straight' };
  if (p.cp1 && p.cp2 && collinear(p.cp1, p.cp2, p)) {
    return { ...p, type: 'rounded' };
  }
  return { ...p, type: 'break' };
}

/** A quadratic's two equivalent cubic controls. */
function quadraticToCubic(
  p0: Point2D,
  q: Point2D,
  p1: Point2D
): { cp2: Point2D; cp1: Point2D } {
  return {
    cp2: { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
    cp1: { x: p1.x + (2 / 3) * (q.x - p1.x), y: p1.y + (2 / 3) * (q.y - p1.y) },
  };
}

/**
 * Walk an `opentype` path into closed contours of `PathPoint`s.
 *
 * `opentype` already hands back y-down SVG coordinates with the baseline at the
 * `y` that was asked for, so nothing has to be flipped here. Quadratics — what
 * TrueType outlines are actually made of — are widened to the cubics this app's
 * model speaks; the two are exactly equivalent, so no accuracy is lost.
 */
function commandsToContours(
  commands: PathCommand[],
  idPrefix: string
): PathPoint[][] {
  const contours: PathPoint[][] = [];
  let current: PathPoint[] = [];
  let counter = 0;

  const push = (x: number, y: number): PathPoint => {
    const point: PathPoint = {
      id: `${idPrefix}_${counter++}`,
      x,
      y,
      type: 'straight',
    };
    current.push(point);
    return point;
  };

  const finish = () => {
    if (current.length < 2) {
      current = [];
      return;
    }
    // A contour usually ends by returning to its own first point. That repeat
    // is the closing segment, not an anchor: fold its incoming handle onto the
    // first point and drop it, or the outline gains a zero-length segment that
    // every later operation has to step over.
    const first = current[0];
    const last = current[current.length - 1];
    if (Math.hypot(last.x - first.x, last.y - first.y) < 1e-6) {
      if (last.cp1) first.cp1 = last.cp1;
      current.pop();
    }
    if (current.length >= 3) contours.push(current.map(typeFromHandles));
    current = [];
  };

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        finish();
        push(cmd.x, cmd.y);
        break;
      case 'L':
        push(cmd.x, cmd.y);
        break;
      case 'C': {
        const prev = current[current.length - 1];
        if (!prev) break;
        prev.cp2 = { x: cmd.x1, y: cmd.y1 };
        push(cmd.x, cmd.y).cp1 = { x: cmd.x2, y: cmd.y2 };
        break;
      }
      case 'Q': {
        const prev = current[current.length - 1];
        if (!prev) break;
        const { cp2, cp1 } = quadraticToCubic(
          prev,
          { x: cmd.x1, y: cmd.y1 },
          { x: cmd.x, y: cmd.y }
        );
        prev.cp2 = cp2;
        push(cmd.x, cmd.y).cp1 = cp1;
        break;
      }
      case 'Z':
        finish();
        break;
    }
  }
  finish();

  return contours;
}

/** An axis-aligned rectangle as one contour — the underline and its siblings. */
function rectContour(
  x: number,
  y: number,
  width: number,
  height: number,
  idPrefix: string
): PathPoint[] {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ].map(([px, py], i) => ({
    id: `${idPrefix}_${i}`,
    x: px,
    y: py,
    type: 'straight' as const,
  }));
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/**
 * One typeset character, kept apart from its neighbours so "convert to objects"
 * has something per-character to hand back.
 */
export interface TypesetCluster {
  /** The characters this cluster draws — more than one only after merging. */
  label: string;
  contours: PathPoint[][];
}

interface TypesetLine {
  baseline: number;
  startX: number;
  endX: number;
  clusters: TypesetCluster[];
}

/**
 * The em-square scale, and the vertical landmarks the decorations hang off.
 *
 * `post.underlinePosition` is where the designer put the underline and is worth
 * respecting — it clears the descenders of that particular face — but plenty of
 * webfont subsets ship it as 0, so there is a proportional fallback behind it.
 */
function metrics(font: Font, fontSize: number) {
  const scale = fontSize / font.unitsPerEm;
  const thickness =
    (font.tables.post?.underlineThickness || 0) * scale ||
    fontSize * DECORATION_FALLBACK_THICKNESS;
  const underline =
    (font.tables.post?.underlinePosition || 0) * scale ||
    fontSize * DECORATION_FALLBACK_UNDERLINE;
  const xHeight = (font.tables.os2?.sxHeight || font.unitsPerEm * 0.5) * scale;

  return {
    scale,
    ascent: font.ascender * scale,
    thickness,
    /** Offset from the baseline, negative upward, as font metrics measure it. */
    underline,
    xHeight,
  };
}

/**
 * Typeset the style's content, one cluster per character.
 *
 * Kerning is read from the font and applied between neighbours; `letterSpacing`
 * is added *between* characters and not after the last one, so a trailing space
 * of tracking does not push a centred line off centre or grow the bounding box
 * past the ink.
 *
 * Characters are laid out one at a time through `charToGlyph` rather than
 * through `font.getPath` on the whole string. That is what keeps the per
 * character geometry that "convert to objects" needs — and it also steps
 * around `opentype`'s shaping engine, which throws outright on the GSUB tables
 * of a fair number of Google's families.
 */
function typeset(style: TextStyle, font: Font, idPrefix: string): TypesetLine[] {
  const m = metrics(font, style.fontSize);
  const lineStep = style.fontSize * style.lineHeight;
  const lines = style.content.split('\n');

  return lines.map((line, lineIndex) => {
    const baseline = style.y + m.ascent + lineIndex * lineStep;
    const chars = [...line];
    const clusters: TypesetCluster[] = [];

    let penX = style.x;
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const glyph = font.charToGlyph(char);

      // Whitespace has an advance and no ink; asking for its (empty) path
      // would just add an empty cluster for "convert to objects" to skip.
      if (!/\s/.test(char)) {
        const contours = commandsToContours(
          glyph.getPath(penX, baseline, style.fontSize, undefined, font)
            .commands,
          `${idPrefix}_l${lineIndex}_c${i}`
        );
        if (contours.length > 0) clusters.push({ label: char, contours });
      }

      penX += glyph.advanceWidth * m.scale;
      if (i < chars.length - 1) {
        penX +=
          font.getKerningValue(glyph, font.charToGlyph(chars[i + 1])) * m.scale +
          style.letterSpacing;
      }
    }

    return { baseline, startX: style.x, endX: penX, clusters };
  });
}

/**
 * The underline / overline / strike-through for one line, as clusters.
 *
 * They are clusters rather than a separate list so that "convert to objects"
 * treats them like anything else that touches a letter: a rule drawn through
 * every character on a line overlaps all of them, so the line converts to one
 * welded object — which is exactly what an underlined word *is*.
 */
function decorationClusters(
  style: TextStyle,
  font: Font,
  line: TypesetLine,
  idPrefix: string
): TypesetCluster[] {
  const m = metrics(font, style.fontSize);
  const width = line.endX - line.startX;
  if (width <= 0) return [];

  const rules: { on: boolean; label: string; y: number }[] = [
    {
      on: style.underline,
      label: 'underline',
      y: line.baseline - m.underline - m.thickness / 2,
    },
    {
      on: style.overline,
      label: 'overline',
      y: line.baseline - m.ascent - m.thickness / 2,
    },
    {
      on: style.lineThrough,
      label: 'strike',
      y: line.baseline - m.xHeight / 2 - m.thickness / 2,
    },
  ];

  return rules
    .filter((r) => r.on)
    .map((r) => ({
      label: r.label,
      contours: [
        rectContour(
          line.startX,
          r.y,
          width,
          m.thickness,
          `${idPrefix}_${r.label}`
        ),
      ],
    }));
}

/** Every cluster of every line, in reading order. */
function typesetClusters(
  style: TextStyle,
  font: Font,
  idPrefix: string
): TypesetCluster[] {
  const out: TypesetCluster[] = [];
  typeset(style, font, idPrefix).forEach((line, i) => {
    out.push(...line.clusters);
    out.push(...decorationClusters(style, font, line, `${idPrefix}_l${i}`));
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Welding overlapping clusters                                        */
/* ------------------------------------------------------------------ */

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function contourBox(points: PathPoint[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    for (const q of [p, p.cp1, p.cp2]) {
      if (!q) continue;
      if (q.x < minX) minX = q.x;
      if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y;
      if (q.y > maxY) maxY = q.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function unionBox(boxes: Box[]): Box {
  return boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
}

const boxesOverlap = (a: Box, b: Box) =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

function pointInRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Split a cluster's contours into outers and the holes inside them.
 *
 * Winding direction would be the quick answer, but it is not a reliable one:
 * TrueType outlines run their outer contours clockwise and PostScript ones
 * anticlockwise, and this app has to take both. Containment gives the same
 * answer without caring — a contour sitting inside an odd number of others is
 * a hole, which is precisely what the `evenodd` fill the canvas draws with
 * means, so the split always agrees with what is on screen.
 */
function splitOutersAndHoles(
  contours: PathPoint[][]
): { outer: PathPoint[]; holes: PathPoint[][] }[] {
  const rings = contours.map((c) => samplePathToPolygon(c, true, OVERLAP_SAMPLES));
  const depth = contours.map((_, i) =>
    rings.reduce(
      (d, ring, j) =>
        i !== j && pointInRing(contours[i][0].x, contours[i][0].y, ring)
          ? d + 1
          : d,
      0
    )
  );

  const groups = contours
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => depth[i] % 2 === 0)
    .map(({ c, i }) => ({ outer: c, index: i, holes: [] as PathPoint[][] }));

  contours.forEach((c, i) => {
    if (depth[i] % 2 === 0) return;
    // Its parent is the innermost even-depth contour that contains it.
    const parent = groups
      .filter(({ index }) => pointInRing(c[0].x, c[0].y, rings[index]))
      .sort((a, b) => depth[b.index] - depth[a.index])[0];
    if (parent) parent.holes.push(c);
  });

  return groups.map(({ outer, holes }) => ({ outer, holes }));
}

/** A cluster as clipper geometry, remembering the curves it came from. */
function clusterToMultiPolygon(
  contours: PathPoint[][],
  index: SourceIndex
): MultiPolygon {
  const polygons: Ring[][] = [];
  for (const { outer, holes } of splitOutersAndHoles(contours)) {
    const outerRing = index.addPath(outer, true);
    if (outerRing.length < 4) continue;
    const rings: Ring[] = [outerRing];
    for (const hole of holes) {
      const holeRing = index.addPath(hole, true);
      if (holeRing.length >= 4) rings.push(holeRing);
    }
    polygons.push(rings);
  }
  return polygons as MultiPolygon;
}

/**
 * Do two clusters actually share ink?
 *
 * The bounding boxes of neighbouring letters overlap constantly — kerning "AV"
 * is enough to do it — so the boxes only decide which pairs are worth the real
 * question, which is put to the clipper on coarsely sampled outlines. Coarse is
 * the right resolution here: this decides whether two letters are *joined*, and
 * a join a sixth of a curve wide is a join.
 */
function clustersTouch(a: TypesetCluster, b: TypesetCluster): boolean {
  const boxA = unionBox(a.contours.map(contourBox));
  const boxB = unionBox(b.contours.map(contourBox));
  if (!boxesOverlap(boxA, boxB)) return false;

  const toMulti = (cluster: TypesetCluster): MultiPolygon =>
    splitOutersAndHoles(cluster.contours).map(({ outer, holes }) => [
      samplePathToPolygon(outer, true, OVERLAP_SAMPLES),
      ...holes.map((h) => samplePathToPolygon(h, true, OVERLAP_SAMPLES)),
    ]) as MultiPolygon;

  try {
    return polygonClipping.intersection(toMulti(a), toMulti(b)).length > 0;
  } catch {
    // A degenerate outline is not worth failing a keystroke over; treating it
    // as separate is the same answer the fast path would have given.
    return false;
  }
}

/**
 * Group clusters that touch, so each group can be welded into one outline.
 *
 * In an ordinary face nothing touches and every character comes back on its
 * own. In a connecting script — or with an underline switched on — the strokes
 * genuinely overlap, and an `evenodd` fill would punch a hole through every
 * join, so those have to be merged into a single outline rather than stacked.
 */
function groupTouchingClusters(clusters: TypesetCluster[]): TypesetCluster[][] {
  const parent = clusters.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      if (find(i) === find(j)) continue;
      if (clustersTouch(clusters[i], clusters[j])) parent[find(i)] = find(j);
    }
  }

  const groups = new Map<number, TypesetCluster[]>();
  clusters.forEach((cluster, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(cluster);
    else groups.set(root, [cluster]);
  });
  return [...groups.values()];
}

/**
 * Resolve a group of clusters into non-overlapping outlines, curves and all.
 *
 * This runs on **every** group, not only groups of more than one, because a
 * single glyph needs it just as much: font outlines are defined under the
 * *nonzero* winding rule, and plenty of families exploit that by drawing a
 * letter as one contour that doubles back through itself rather than as an
 * outline plus a separate counter. Inter's and Roboto's "e" are both built that
 * way. Handed to an `evenodd` fill — which is what this app and the Canva
 * export both use — such a contour comes out with its counter filled in and a
 * sliver of white where the path crosses itself.
 *
 * A union is exactly the operation that turns winding-defined geometry into the
 * outline-plus-holes form both fill rules agree on, so every cluster goes
 * through one. It also welds a group whose members genuinely touch, which is
 * the same question asked of more than one letter at a time.
 *
 * It goes through the curve-preserving bridge the Merge tab uses, so a curve
 * the operation did not touch comes back as the very same bezier with the very
 * same anchors; new anchors appear only where outlines actually cross.
 */
function weldGroup(
  group: TypesetCluster[],
  baseId: string
): { points: PathPoint[]; subPaths: PathPoint[][] }[] {
  const index = new SourceIndex();
  const parts = group.map((c) => clusterToMultiPolygon(c.contours, index));
  const usable = parts.filter((p) => p.length > 0);
  if (usable.length === 0) return [];

  let merged: MultiPolygon;
  try {
    merged = polygonClipping.union(usable[0], ...usable.slice(1));
  } catch {
    // Fall back to the raw contours rather than losing the characters.
    return [
      {
        points: group[0].contours[0],
        subPaths: group.flatMap((c) => c.contours).slice(1),
      },
    ];
  }

  return merged
    .map((polygon, i) => {
      const { points, subPaths } = polygonToPathPoints(
        polygon,
        `${baseId}_w${i}`,
        index
      );
      return { points, subPaths: subPaths ?? [] };
    })
    .filter((p) => p.points.length >= 3);
}

/* ------------------------------------------------------------------ */
/* Building the shape                                                  */
/* ------------------------------------------------------------------ */

export interface TextGeometry {
  points: PathPoint[];
  subPaths?: PathPoint[][];
}

/**
 * The outlines for a text style, as one shape's worth of contours.
 *
 * Both the canvas and the Canva export fill with `evenodd`, and glyph outlines
 * are not drawn for that rule — they are drawn for *nonzero*. The two agree on
 * a plain counter nested inside its letter, which is why an "o" looks right
 * either way, but they disagree wherever outlines actually overlap, and font
 * outlines overlap more often than one would think:
 *
 *   - Inter's and Roboto's "e" is a *single* contour that doubles back through
 *     itself instead of an outline plus a separate counter. Under `evenodd` the
 *     counter fills in and a sliver of white opens where the path crosses.
 *   - An underline vanishes everywhere a descender crosses it.
 *   - A connecting script comes apart at every join.
 *
 * Because the export fills the same way, none of that is a display artefact —
 * it is what Canva would import. So every cluster is put through a union, which
 * is precisely the operation that restates winding-defined geometry as the
 * outline-plus-holes form both rules agree on, and which welds genuinely
 * touching clusters in the same pass.
 */
export function buildTextGeometry(
  style: TextStyle,
  font: Font,
  idPrefix: string
): TextGeometry {
  const clusters = typesetClusters(style, font, idPrefix);
  if (clusters.length === 0) return { points: [] };

  const contours: PathPoint[][] = [];
  groupTouchingClusters(clusters).forEach((group, i) => {
    for (const welded of weldGroup(group, `${idPrefix}_g${i}`)) {
      contours.push(welded.points, ...welded.subPaths);
    }
  });

  if (contours.length === 0) return { points: [] };
  return {
    points: contours[0],
    subPaths: contours.length > 1 ? contours.slice(1) : undefined,
  };
}

/** A layer name that says what the text says, without running off the panel. */
export function textLayerName(style: TextStyle): string {
  const oneLine = style.content.replace(/\s+/g, ' ').trim();
  if (!oneLine) return 'Text';
  return oneLine.length > 24 ? `${oneLine.slice(0, 24)}…` : oneLine;
}

/**
 * Rebuild a text layer's outlines from its descriptor.
 *
 * The layer keeps its id, its place in the stack and its styling — only the
 * geometry and the auto-generated name are replaced — so retyping a word does
 * not cost the selection or send the layer to the front.
 */
export function applyTextStyle(
  shape: VectorShape,
  style: TextStyle,
  font: Font
): VectorShape {
  const { points, subPaths } = buildTextGeometry(style, font, shape.id);
  const renamed =
    !shape.text || shape.name === textLayerName(shape.text)
      ? textLayerName(style)
      : shape.name;

  return {
    ...shape,
    name: renamed,
    text: style,
    points,
    subPaths,
    closed: true,
  };
}

export function createTextShape(style: TextStyle, font: Font): VectorShape {
  const id = generateShapeId();
  const { points, subPaths } = buildTextGeometry(style, font, id);

  return {
    id,
    name: textLayerName(style),
    text: style,
    points,
    subPaths,
    closed: true,
    // The same indigo every other new shape starts in. A near-black default
    // would read as "type" but disappear into the dark-mode canvas, and the
    // fill is only a working colour anyway — the Canva export writes one
    // merged outline and takes no colour from it.
    fillColor: '#6366f1',
    strokeColor: '#4338ca',
    strokeWidth: 0,
    opacity: 1,
    visible: true,
    locked: false,
    isFrameCandidate: true,
  };
}

/**
 * Drop the text descriptor, leaving plain outlines behind.
 *
 * Anything that changes a text layer's geometry by some route other than the
 * font settings — editing its anchors, rotating it, welding it into a boolean
 * result — has to call this. Keeping a descriptor that no longer describes the
 * geometry would mean the next nudge of the font size silently threw the edit
 * away and redrew the word where it used to be.
 */
export function detachText(shape: VectorShape): VectorShape {
  if (!shape.text) return shape;
  const { text: _dropped, ...rest } = shape;
  return rest;
}

/** Move a text layer's typesetting origin along with its outlines. */
export function offsetTextOrigin(
  shape: VectorShape,
  dx: number,
  dy: number
): VectorShape {
  if (!shape.text) return shape;
  return {
    ...shape,
    text: { ...shape.text, x: shape.text.x + dx, y: shape.text.y + dy },
  };
}

/**
 * Restate a text style at a different size.
 *
 * Used when a text layer is scaled by its selection box: a uniform scale *is*
 * expressible as a font size, so the layer can be resized on the canvas and
 * stay editable. A stretch that is not uniform is not — no font size draws a
 * word half as wide as it is tall — so the caller detaches instead.
 */
export function scaleTextStyle(
  style: TextStyle,
  factor: number,
  origin: Point2D
): TextStyle {
  return {
    ...style,
    fontSize: style.fontSize * factor,
    letterSpacing: style.letterSpacing * factor,
    // `origin` is where the typesetting origin has already been mapped to by
    // the caller's own coordinate transform; only the size scales here.
    x: origin.x,
    y: origin.y,
  };
}

/* ------------------------------------------------------------------ */
/* Convert to objects                                                  */
/* ------------------------------------------------------------------ */

/**
 * Break a text layer into one layer per character.
 *
 * Characters whose outlines genuinely touch come back as a single layer welded
 * into one outline — which is what a connecting script needs, since its letters
 * are drawn to run into each other and splitting them apart mid-stroke would
 * leave two shapes with a notch between them. An underline does the same thing
 * to a whole line, and for the same reason.
 *
 * The result is plain geometry: the pieces carry no text descriptor, so this is
 * a one-way door and the panel says so.
 */
export function splitTextIntoShapes(
  shape: VectorShape,
  font: Font
): VectorShape[] {
  if (!shape.text) return [shape];

  const clusters = typesetClusters(shape.text, font, shape.id);
  if (clusters.length === 0) return [];

  const out: VectorShape[] = [];

  groupTouchingClusters(clusters).forEach((group, groupIndex) => {
    const label = group
      .map((c) => c.label)
      .filter((l) => l.length === 1)
      .join('');

    // Every polygon the group welds down to goes into *one* layer, as an
    // outline plus sub-paths. A dotted "i" is two disjoint outlines and can
    // never be one filled path, but it is still one letter — splitting it
    // across two layers would mean moving an "i" took two drags.
    const welded = weldGroup(group, `${shape.id}_g${groupIndex}`);
    const contours = welded.flatMap((w) => [w.points, ...w.subPaths]);
    if (contours.length === 0) return;

    const id = generateShapeId();
    out.push({
      ...detachText(shape),
      id,
      name: label || `${shape.name} part ${groupIndex + 1}`,
      points: contours[0].map((p, n) => ({ ...p, id: `${id}_p${n}` })),
      subPaths:
        contours.length > 1
          ? contours
              .slice(1)
              .map((sub, s) => sub.map((p, n) => ({ ...p, id: `${id}_s${s}_${n}` })))
          : undefined,
      closed: true,
    });
  });

  return out;
}
