import { PathPoint, VectorShape } from '../types';
import { generateShapeId } from './shapePresets';

function offsetPoints(
  points: PathPoint[],
  idPrefix: string,
  dx: number,
  dy: number
): PathPoint[] {
  return points.map((p, i) => ({
    ...p,
    id: `${idPrefix}_p${i}`,
    x: p.x + dx,
    y: p.y + dy,
    cp1: p.cp1 ? { x: p.cp1.x + dx, y: p.cp1.y + dy } : undefined,
    cp2: p.cp2 ? { x: p.cp2.x + dx, y: p.cp2.y + dy } : undefined,
  }));
}

/**
 * Copies a shape, giving it fresh ids and nudging it by the given offset.
 *
 * Sub-paths are rebuilt too — spreading the original would leave a compound
 * shape's holes at the old position while its outline moved away.
 */
export function duplicateShape(
  shape: VectorShape,
  dx = 25,
  dy = 25
): VectorShape {
  const id = generateShapeId();

  return {
    ...shape,
    id,
    name: shape.name.endsWith(' Copy') ? shape.name : `${shape.name} Copy`,
    points: offsetPoints(shape.points, id, dx, dy),
    subPaths: shape.subPaths?.map((sub, i) =>
      offsetPoints(sub, `${id}_s${i}`, dx, dy)
    ),
  };
}
