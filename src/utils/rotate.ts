import { PathPoint, Point2D, VectorShape } from '../types';
import { getShapeBounds } from './bezier';
import { unionBounds } from './guides';

/** Holding Shift while dragging the rotate handle locks to this increment. */
export const ROTATE_SNAP_DEG = 15;

/** Default angle in the Rotate panel's "by angle" field. */
export const ROTATE_DEFAULT_STEP = 15;

export const ROTATE_MIN_STEP = 0.1;
export const ROTATE_MAX_STEP = 360;

/**
 * Where the rotation pivots.
 *
 * `selection` turns the whole selection as one rigid block about its combined
 * centre, which is what dragging the handle on the bounding box does.
 * `each` turns every shape about its own centre, so a row of objects each spin
 * in place instead of swinging around a common point.
 */
export type RotateOrigin = 'selection' | 'each';

export function clampRotateStep(step: number): number {
  if (!Number.isFinite(step)) return ROTATE_DEFAULT_STEP;
  return Math.min(ROTATE_MAX_STEP, Math.max(ROTATE_MIN_STEP, Math.abs(step)));
}

/** An equivalent angle in (-180, 180], so a readout says -90° rather than 270°. */
export function normalizeAngle(deg: number): number {
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/** Round to the nearest multiple of `step` degrees. */
export function snapAngle(deg: number, step = ROTATE_SNAP_DEG): number {
  if (step <= 0) return deg;
  return Math.round(deg / step) * step;
}

/**
 * The angle, in degrees, of `p` seen from `center`.
 *
 * Measured clockwise from straight up, because canvas y grows downwards and the
 * rotate handle sits above the box: pointing at the handle reads as 0°.
 */
export function pointerAngle(center: Point2D, p: Point2D): number {
  return (Math.atan2(p.x - center.x, center.y - p.y) * 180) / Math.PI;
}

/** True when the angle leaves an axis-aligned shape axis-aligned. */
function isQuarterTurn(deg: number): boolean {
  const off = Math.abs(normalizeAngle(deg)) % 90;
  return off < 1e-6 || Math.abs(off - 90) < 1e-6;
}

function rotateAbout(p: Point2D, c: Point2D, cos: number, sin: number): Point2D {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  // Canvas y grows downwards, so this turns clockwise for a positive angle —
  // the direction the "↻" buttons and a rightwards handle drag both mean.
  return {
    x: c.x + dx * cos - dy * sin,
    y: c.y + dx * sin + dy * cos,
  };
}

/** Rotate a point list about `c`. Handles turn with their anchor. */
function rotatePathPoints(
  points: PathPoint[],
  c: Point2D,
  cos: number,
  sin: number
): PathPoint[] {
  return points.map((p) => {
    const anchor = rotateAbout(p, c, cos, sin);
    return {
      ...p,
      x: anchor.x,
      y: anchor.y,
      cp1: p.cp1 ? rotateAbout(p.cp1, c, cos, sin) : undefined,
      cp2: p.cp2 ? rotateAbout(p.cp2, c, cos, sin) : undefined,
    };
  });
}

/** Centre of a shape's bounding box. */
export function shapeCenter(shape: VectorShape): Point2D {
  const b = getShapeBounds(shape);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** Centre of the box enclosing every selected shape, or null if none are. */
export function selectionCenter(
  shapes: VectorShape[],
  selectedIds: string[]
): Point2D | null {
  const b = unionBounds(shapes.filter((s) => selectedIds.includes(s.id)));
  if (!b) return null;
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/**
 * Rotate one shape by `angleDeg` about `center`, keeping its id.
 *
 * There is no rotation field on a shape — geometry is a bezier point list — so
 * the turn is baked into the coordinates, as mirroring and resizing already do.
 *
 * A rectangle's `cornerRadiusPct` is dropped unless the turn is a quarter of a
 * circle. That field means "rebuild me as an axis-aligned rounded rect from my
 * bounding box", which is only still true of a rectangle that stayed square to
 * the axes; keeping it would snap a shape rotated 30° back upright the next
 * time the radius slider or a resize handle moved.
 */
export function rotateShape(
  shape: VectorShape,
  angleDeg: number,
  center: Point2D
): VectorShape {
  if (angleDeg % 360 === 0) return shape;

  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rotated: VectorShape = {
    ...shape,
    points: rotatePathPoints(shape.points, center, cos, sin),
    subPaths: shape.subPaths?.map((sub) =>
      rotatePathPoints(sub, center, cos, sin)
    ),
  };

  if (rotated.cornerRadiusPct !== undefined && !isQuarterTurn(angleDeg)) {
    delete rotated.cornerRadiusPct;
  }

  return rotated;
}

/**
 * Rotate the selected shapes by `angleDeg`.
 *
 * `center` fixes the pivot; pass `null` to turn each shape about its own
 * centre. Locked shapes are left alone — they cannot be dragged on the canvas
 * either, so a rotation must not be a way around the lock.
 */
export function rotateShapes(
  shapes: VectorShape[],
  selectedIds: string[],
  angleDeg: number,
  center: Point2D | null
): VectorShape[] {
  if (selectedIds.length === 0 || angleDeg % 360 === 0) return shapes;

  return shapes.map((s) => {
    if (!selectedIds.includes(s.id) || s.locked) return s;
    return rotateShape(s, angleDeg, center ?? shapeCenter(s));
  });
}

/**
 * Pivot for a rotation of the current selection under the chosen origin.
 *
 * `each` has no single pivot, so it returns null — which is exactly what
 * `rotateShapes` reads as "each shape about its own centre".
 */
export function resolveRotateCenter(
  shapes: VectorShape[],
  selectedIds: string[],
  origin: RotateOrigin
): Point2D | null {
  if (origin === 'each') return null;
  return selectionCenter(shapes, selectedIds);
}
