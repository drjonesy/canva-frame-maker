import { PathPoint, Point2D } from '../types';

/**
 * Dropping a new anchor onto an existing outline: finding the spot under the
 * pointer, and splitting the segment there without moving the curve.
 *
 * The Pen appends to the end of a path, which is the wrong gesture once a path
 * is closed — there is no "end" left. The Add Anchor tool works on the segment
 * instead, so the outline it edits comes out the same shape it went in.
 */

/** A position on a path, as the segment it sits on and how far along it is. */
export interface PathProjection {
  /** Index of the anchor the segment starts at. */
  segIndex: number;
  /** Position along that segment: 0 at its start anchor, 1 at its end. */
  t: number;
  /** Where that lands, in canvas coordinates. */
  point: Point2D;
  /** Distance from the queried position, in canvas units. */
  distance: number;
}

type Cubic = [Point2D, Point2D, Point2D, Point2D];

const lerp = (a: Point2D, b: Point2D, t: number): Point2D => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/**
 * Segment `i` as a cubic. A straight run is the cubic whose handles sit on its
 * own end points, so one bit of maths covers both kinds of segment.
 */
function segmentCubic(points: PathPoint[], i: number): Cubic {
  const curr = points[i];
  const next = points[(i + 1) % points.length];
  return [
    { x: curr.x, y: curr.y },
    curr.cp2 ?? { x: curr.x, y: curr.y },
    next.cp1 ?? { x: next.x, y: next.y },
    { x: next.x, y: next.y },
  ];
}

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): Point2D {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

const dist2 = (a: Point2D, b: Point2D) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** How many segments a closed path has; an open one is a segment short. */
export function segmentCount(points: PathPoint[], closed: boolean): number {
  if (points.length < 2) return 0;
  return closed ? points.length : points.length - 1;
}

/**
 * The point on the outline nearest `target`, or null if the path has no
 * segments to land on.
 *
 * Each segment is scanned coarsely and the best hit then refined by bisection,
 * which is plenty for a pointer target and far cheaper than solving the
 * quintic that the true nearest-point on a cubic requires.
 */
export function projectOntoPath(
  points: PathPoint[],
  closed: boolean,
  target: Point2D,
  samplesPerSegment = 24
): PathProjection | null {
  const segments = segmentCount(points, closed);
  if (segments === 0) return null;

  let best: { segIndex: number; t: number; point: Point2D; d2: number } | null = null;

  for (let i = 0; i < segments; i++) {
    const cubic = segmentCubic(points, i);

    let bestT = 0;
    let bestD2 = Infinity;
    for (let s = 0; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const d2 = dist2(cubicAt(cubic, t), target);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestT = t;
      }
    }

    // Narrow the window around the best sample. Distance to a cubic is not
    // globally unimodal, but it is over one sample's width, so bisecting on
    // which half is closer converges on the real minimum in that window.
    let lo = Math.max(0, bestT - 1 / samplesPerSegment);
    let hi = Math.min(1, bestT + 1 / samplesPerSegment);
    for (let iter = 0; iter < 20; iter++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (dist2(cubicAt(cubic, m1), target) < dist2(cubicAt(cubic, m2), target)) {
        hi = m2;
      } else {
        lo = m1;
      }
    }

    const t = (lo + hi) / 2;
    const point = cubicAt(cubic, t);
    const d2 = dist2(point, target);
    if (!best || d2 < best.d2) best = { segIndex: i, t, point, d2 };
  }

  if (!best) return null;
  return {
    segIndex: best.segIndex,
    t: best.t,
    point: best.point,
    distance: Math.sqrt(best.d2),
  };
}

/** Two positions that are the same position to within floating-point noise. */
const samePoint = (a: Point2D, b: Point2D) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

/**
 * Insert an anchor at `projection`, splitting that segment in two.
 *
 * On a curve the split is de Casteljau's: the two halves carry the handles
 * that reproduce the original curve exactly, so the outline does not so much
 * as wobble. On a straight run the new anchor is bare, keeping the corner
 * straight rather than turning it into a curve with flat handles.
 *
 * Coordinates are left unrounded on purpose — the Pen rounds because it is
 * placing a point wherever you clicked, but rounding here would drag the
 * outline off its own path.
 */
export function insertPointOnPath(
  points: PathPoint[],
  projection: PathProjection
): { points: PathPoint[]; insertedId: string } {
  const i = projection.segIndex;
  const j = (i + 1) % points.length;
  const curr = points[i];
  const next = points[j];

  const id = `pt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const straight = !curr.cp2 && !next.cp1;

  const updated = [...points];

  if (straight) {
    updated.splice(i + 1, 0, {
      id,
      x: projection.point.x,
      y: projection.point.y,
      type: 'straight',
    });
    return { points: updated, insertedId: id };
  }

  const [p0, p1, p2, p3] = segmentCubic(points, i);
  const t = projection.t;
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const anchor = lerp(d, e, t);

  // A handle landing on its own anchor is no handle at all — that end of the
  // segment was straight and stays straight, and leaving it out keeps a stray
  // handle dot from appearing under the anchor.
  updated[i] = samePoint(a, { x: curr.x, y: curr.y })
    ? { ...curr, cp2: undefined }
    : { ...curr, cp2: a };
  updated[j] = samePoint(c, { x: next.x, y: next.y })
    ? { ...next, cp1: undefined }
    : { ...next, cp1: c };

  updated.splice(i + 1, 0, {
    id,
    x: anchor.x,
    y: anchor.y,
    type: 'rounded',
    cp1: d,
    cp2: e,
  });

  return { points: updated, insertedId: id };
}
