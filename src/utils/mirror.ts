import { Guide, GuideAxis, PathPoint, VectorShape } from '../types';
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
 * Reflect a point list across a guide.
 *
 * Handles move with their anchor, and `cp1`/`cp2` keep their roles: reflection
 * maps each curve onto its mirror image without changing the order the points
 * are visited, so the incoming handle is still the incoming one.
 */
function mirrorPoints(
  points: PathPoint[],
  idPrefix: string,
  axis: GuideAxis,
  position: number
): PathPoint[] {
  const flip = (p: { x: number; y: number }) =>
    axis === 'x'
      ? { x: reflectCoord(p.x, position), y: p.y }
      : { x: p.x, y: reflectCoord(p.y, position) };

  return points.map((p, i) => {
    const anchor = flip(p);
    return {
      ...p,
      id: `${idPrefix}_p${i}`,
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
    points: mirrorPoints(shape.points, id, axis, position),
    subPaths: shape.subPaths?.map((sub, i) =>
      mirrorPoints(sub, `${id}_s${i}`, axis, position)
    ),
  };
}

/**
 * The guide Mirror reflects across.
 *
 * The most recently picked selected guide wins — `selectedGuideIds` is appended
 * to as guides are shift-clicked, so the last entry is the latest choice. With
 * nothing selected a lone guide is used, since there is then no ambiguity; with
 * several guides and no selection there is no way to tell which was meant.
 */
export function resolveMirrorGuide(
  guides: Guide[],
  selectedGuideIds: string[]
): Guide | null {
  for (let i = selectedGuideIds.length - 1; i >= 0; i--) {
    const picked = guides.find((g) => g.id === selectedGuideIds[i]);
    if (picked) return picked;
  }
  return guides.length === 1 ? guides[0] : null;
}
