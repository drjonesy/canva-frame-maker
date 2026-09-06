import { GuideAxis, PathPoint, Point2D, VectorShape } from '../types';
import { shapeCenter } from './rotate';
import { generateShapeId } from './shapePresets';

/**
 * Reflect one coordinate across a line at `position`.
 *
 * The distance is preserved and the side flips: a point 5px to the left of the
 * line lands 5px to its right.
 */
export function reflectCoord(value: number, position: number): number {
  return 2 * position - value;
}

/**
 * Reflect a point list across a line.
 *
 * Handles move with their anchor, and `cp1`/`cp2` keep their roles: reflection
 * maps each curve onto its mirror image without changing the order the points
 * are visited, so the incoming handle is still the incoming one.
 *
 * `idPrefix` renumbers the points for a copy; omit it — as flipping in place
 * does — to keep the ids, so a point sub-selection survives the reflection.
 */
function mirrorPoints(
  points: PathPoint[],
  axis: GuideAxis,
  position: number,
  idPrefix?: string
): PathPoint[] {
  const flip = (p: { x: number; y: number }) =>
    axis === 'x'
      ? { x: reflectCoord(p.x, position), y: p.y }
      : { x: p.x, y: reflectCoord(p.y, position) };

  return points.map((p, i) => {
    const anchor = flip(p);
    return {
      ...p,
      id: idPrefix ? `${idPrefix}_p${i}` : p.id,
      x: anchor.x,
      y: anchor.y,
      cp1: p.cp1 ? flip(p.cp1) : undefined,
      cp2: p.cp2 ? flip(p.cp2) : undefined,
    };
  });
}

/**
 * A new shape that is `shape` reflected across the given guide.
 *
 * Sub-paths are reflected too — spreading the originals would leave a compound
 * shape's holes on the near side of the guide while its outline crossed over.
 */
export function mirrorShape(
  shape: VectorShape,
  axis: GuideAxis,
  position: number
): VectorShape {
  const id = generateShapeId();

  return {
    ...shape,
    id,
    name: shape.name.endsWith(' Mirror') ? shape.name : `${shape.name} Mirror`,
    points: mirrorPoints(shape.points, axis, position, id),
    subPaths: shape.subPaths?.map((sub, i) =>
      mirrorPoints(sub, axis, position, `${id}_s${i}`)
    ),
  };
}

/**
 * Which way round a flip turns the shape.
 *
 * `horizontal` swaps left for right — the reflection is across a *vertical*
 * line — and `vertical` swaps top for bottom. The names describe the direction
 * the shape moves, which is how every design tool labels the two.
 */
export type FlipDirection = 'horizontal' | 'vertical';

/** The axis the reflection line lies on for each direction. */
const FLIP_AXIS: Record<FlipDirection, GuideAxis> = {
  horizontal: 'x',
  vertical: 'y',
};

/**
 * Reflect a shape about `center`, in place: same id, same points, same name.
 *
 * Unlike Mirror — which drops a reflected *copy* across a guide — a flip is a
 * transform of the shape itself, so it keeps its identity the way a rotation
 * does. The bounding box does not move: reflecting about the centre of the box
 * maps the box onto itself.
 *
 * A rectangle's `cornerRadiusPct` survives, unlike an off-axis rotation: a flip
 * maps an axis-aligned rectangle onto an axis-aligned rectangle of the same
 * size, so "rebuild me from my bounding box" still describes the shape.
 */
export function flipShape(
  shape: VectorShape,
  direction: FlipDirection,
  center: Point2D
): VectorShape {
  const axis = FLIP_AXIS[direction];
  const position = axis === 'x' ? center.x : center.y;

  return {
    ...shape,
    points: mirrorPoints(shape.points, axis, position),
    subPaths: shape.subPaths?.map((sub) => mirrorPoints(sub, axis, position)),
  };
}

/**
 * Flip the selected shapes.
 *
 * `center` fixes the line to reflect about; pass `null` to flip each shape
 * about its own centre, so a row of objects each turn in place rather than
 * swapping sides of the selection. Locked shapes are left alone — they cannot
 * be dragged on the canvas either, so a flip must not be a way around the lock.
 */
export function flipShapes(
  shapes: VectorShape[],
  selectedIds: string[],
  direction: FlipDirection,
  center: Point2D | null
): VectorShape[] {
  if (selectedIds.length === 0) return shapes;

  return shapes.map((s) => {
    if (!selectedIds.includes(s.id) || s.locked) return s;
    return flipShape(s, direction, center ?? shapeCenter(s));
  });
}
