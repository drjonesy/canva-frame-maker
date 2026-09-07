import { PathPoint, VectorShape } from '../types';
import { getShapeBounds } from './bezier';
import { Bounds, ResizeResult } from './resize';
import { buildRectPoints, cornerRadiusPx } from './shapePresets';
import { detachText, scaleTextStyle } from './textToShape';

/** How far the two axes may differ and still count as one scale factor. */
const UNIFORM_EPSILON = 1e-4;

/**
 * Carry a text layer's style through a scale, or give up on it.
 *
 * A uniform scale *is* a font size: doubling the box is the same word set twice
 * as large, so the layer keeps its descriptor and stays editable. A stretch is
 * not — no font size draws a word half as wide as it is tall — so there the
 * descriptor is dropped and the layer becomes the outlines it has been pulled
 * into, the same bargain `cornerRadiusPct` strikes with an off-axis rotation.
 */
function scaleText(
  shape: VectorShape,
  from: Bounds,
  to: ResizeResult
): VectorShape {
  if (!shape.text) return shape;
  if (to.scaleX <= 0 || Math.abs(to.scaleX - to.scaleY) > UNIFORM_EPSILON) {
    return detachText(shape);
  }

  return {
    ...shape,
    text: scaleTextStyle(shape.text, to.scaleX, {
      x: mapX(shape.text.x, from, to),
      y: mapY(shape.text.y, from, to),
    }),
  };
}

/** Map one coordinate from the old box into the new one. */
function mapX(x: number, from: Bounds, to: ResizeResult): number {
  return to.minX + (x - from.minX) * to.scaleX;
}

function mapY(y: number, from: Bounds, to: ResizeResult): number {
  return to.minY + (y - from.minY) * to.scaleY;
}

/** Scale a point list, carrying each anchor's handles along with it. */
function scalePathPoints(
  points: PathPoint[],
  from: Bounds,
  to: ResizeResult
): PathPoint[] {
  return points.map((p) => ({
    ...p,
    x: mapX(p.x, from, to),
    y: mapY(p.y, from, to),
    cp1: p.cp1
      ? { x: mapX(p.cp1.x, from, to), y: mapY(p.cp1.y, from, to) }
      : undefined,
    cp2: p.cp2
      ? { x: mapX(p.cp2.x, from, to), y: mapY(p.cp2.y, from, to) }
      : undefined,
  }));
}

/**
 * Scale the selected shapes so the box `from` becomes the box `to`.
 *
 * The whole selection is treated as one block: every shape keeps its place and
 * its proportions relative to the others, which is what dragging a handle on a
 * box drawn around several shapes has to mean. With one shape picked the box is
 * that shape's own, so this is the plain resize it always was.
 *
 * Locked shapes are left alone, exactly as rotation leaves them — a scale must
 * not be a way around the lock.
 *
 * A rectangle with `cornerRadiusPct` is rebuilt from its scaled bounds rather
 * than having its points stretched, so its corners keep their radius instead of
 * being drawn out into an oval.
 */
export function scaleShapes(
  shapes: VectorShape[],
  selectedIds: string[],
  from: Bounds,
  to: ResizeResult
): VectorShape[] {
  if (selectedIds.length === 0) return shapes;

  return shapes.map((s) => {
    if (!selectedIds.includes(s.id) || s.locked) return s;

    if (s.cornerRadiusPct !== undefined) {
      const b = getShapeBounds(s);
      const minX = mapX(b.minX, from, to);
      const minY = mapY(b.minY, from, to);
      const maxX = mapX(b.maxX, from, to);
      const maxY = mapY(b.maxY, from, to);

      return {
        ...s,
        points: buildRectPoints(
          s.id,
          minX,
          minY,
          maxX,
          maxY,
          cornerRadiusPx(s.cornerRadiusPct, maxX - minX, maxY - minY)
        ),
      };
    }

    return scaleText(
      {
        ...s,
        points: scalePathPoints(s.points, from, to),
        subPaths: s.subPaths?.map((sub) => scalePathPoints(sub, from, to)),
      },
      from,
      to
    );
  });
}
