import { GuideAxis, PathPoint, Point2D, VectorShape } from '../types';

/**
 * The line the Parallel tool lines up with a guide: two anchor points of one
 * shape, picked under Sub-Select.
 *
 * `adjacent` says whether they are the two ends of a real segment. Any two
 * anchors define a usable reference line — two opposite corners are a fair way
 * to level a shape — so a non-adjacent pair is allowed and only reported.
 */
export interface ParallelEdge {
  a: PathPoint;
  b: PathPoint;
  adjacent: boolean;
}

/**
 * The edge to rotate, or null when the selection does not describe one.
 *
 * Exactly two points must be picked: one anchor is a position, not a
 * direction, and three or more have no single direction between them.
 */
export function resolveParallelEdge(
  shape: VectorShape,
  selectedPointIds: string[]
): ParallelEdge | null {
  if (selectedPointIds.length !== 2) return null;

  const pts = shape.points;
  const ia = pts.findIndex((p) => p.id === selectedPointIds[0]);
  const ib = pts.findIndex((p) => p.id === selectedPointIds[1]);
  if (ia === -1 || ib === -1) return null;

  const a = pts[ia];
  const b = pts[ib];
  if (a.x === b.x && a.y === b.y) return null;

  const gap = Math.abs(ia - ib);
  const adjacent = gap === 1 || (shape.closed && gap === pts.length - 1);

  return { a, b, adjacent };
}

/**
 * Direction of the line from `a` to `b`, in degrees.
 *
 * Measured the way `rotateShape` turns: canvas y grows downwards, so a
 * positive angle sweeps clockwise on screen and 90° points straight down.
 */
export function edgeAngleDeg(a: Point2D, b: Point2D): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/**
 * An equivalent angle in (-90, 90].
 *
 * A line is the same line read backwards, so a half turn changes nothing about
 * it: wrapping here is what makes the tool take the *shortest* way round
 * instead of flipping a shape end over end to reach the same alignment.
 */
export function wrapToHalfTurn(deg: number): number {
  const wrapped = ((deg % 180) + 180) % 180;
  return wrapped > 90 ? wrapped - 180 : wrapped;
}

/**
 * How far to turn, clockwise, so the edge runs parallel to a guide on `axis`.
 *
 * A vertical guide (`x`) wants the edge pointing straight down the screen, a
 * horizontal one (`y`) straight across it. The result is never more than a
 * quarter turn in either direction.
 */
export function parallelRotation(edge: ParallelEdge, axis: GuideAxis): number {
  const target = axis === 'x' ? 90 : 0;
  return wrapToHalfTurn(target - edgeAngleDeg(edge.a, edge.b));
}

/**
 * Pivot for the turn: the middle of the edge.
 *
 * The edge is the part being lined up, so it is the part that should stay put;
 * pivoting on the bounding-box centre instead would swing it off the spot the
 * user is looking at, and leave a second move to do before it sat flush.
 */
export function edgeMidpoint(edge: ParallelEdge): Point2D {
  return { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 };
}

/** Below this many degrees the edge is treated as already parallel. */
export const PARALLEL_EPSILON_DEG = 0.01;
