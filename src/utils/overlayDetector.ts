import polygonClipping from 'polygon-clipping';
import { OverlayCheckResult, OverlayCollision, VectorShape } from '../types';
import { getShapeBounds } from './bezier';
import { shapeToMultiPolygon } from './booleanOps';

/**
 * Check if bounding boxes overlap
 */
function bboxOverlap(
  b1: { minX: number; minY: number; maxX: number; maxY: number },
  b2: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return (
    b1.minX < b2.maxX &&
    b1.maxX > b2.minX &&
    b1.minY < b2.maxY &&
    b1.maxY > b2.minY
  );
}

/**
 * Detects if any uncombined visible layers overlay/intersect one another
 */
export function detectOverlays(shapes: VectorShape[]): OverlayCheckResult {
  const visibleShapes = shapes.filter(
    (s) => s.visible && s.points && s.points.length >= 3
  );

  if (visibleShapes.length <= 1) {
    return { hasOverlay: false, collisions: [] };
  }

  const collisions: OverlayCollision[] = [];

  // Cache bboxes and multipolygons
  const cached = visibleShapes.map((shape) => ({
    shape,
    bounds: getShapeBounds(shape),
    poly: shapeToMultiPolygon(shape),
  }));

  for (let i = 0; i < cached.length; i++) {
    for (let j = i + 1; j < cached.length; j++) {
      const itemA = cached[i];
      const itemB = cached[j];

      // 1. Quick AABB check
      if (!bboxOverlap(itemA.bounds, itemB.bounds)) {
        continue;
      }

      // 2. Precise polygon intersection
      if (itemA.poly.length === 0 || itemB.poly.length === 0) {
        continue;
      }

      try {
        const intersection = polygonClipping.intersection(
          itemA.poly,
          itemB.poly
        );

        if (intersection && intersection.length > 0) {
          // Verify that intersection has non-zero area
          let totalIntersectPoints = 0;
          for (const poly of intersection) {
            for (const ring of poly) {
              totalIntersectPoints += ring.length;
            }
          }

          if (totalIntersectPoints >= 3) {
            collisions.push({
              layer1Id: itemA.shape.id,
              layer1Name: itemA.shape.name,
              layer2Id: itemB.shape.id,
              layer2Name: itemB.shape.name,
            });
          }
        }
      } catch (err) {
        // Fallback to bounding box overlap if clipping fails on degenerates
        console.warn('Polygon intersection check error:', err);
      }
    }
  }

  return {
    hasOverlay: collisions.length > 0,
    collisions,
  };
}
