import polygonClipping, { MultiPolygon, Polygon } from 'polygon-clipping';
import { BooleanOperation, PathPoint, VectorShape } from '../types';
import { generateShapeId } from './shapePresets';
import { SourceIndex, ringToPathPoints } from './pathClipping';

/**
 * Convert a VectorShape into a polygon-clipping MultiPolygon.
 *
 * Only for callers that just need the geometry (overlap tests). An operation
 * whose *result* becomes a shape must build its inputs through one shared
 * `SourceIndex` instead, so the curves can be restored afterwards.
 */
export function shapeToMultiPolygon(shape: VectorShape): MultiPolygon {
  return new SourceIndex().addShape(shape);
}

/**
 * Convert a polygon-clipping Polygon into PathPoint[][] (outer ring + holes),
 * re-cutting each run of the result from the source curve it came from — see
 * `pathClipping.ts`. The clipper deals in polygons, but the shape that comes
 * back out is beziers again, carrying the original anchors.
 */
export function polygonToPathPoints(
  polygon: Polygon,
  baseId: string,
  index: SourceIndex
): { points: PathPoint[]; subPaths?: PathPoint[][] } {
  if (!polygon || polygon.length === 0) {
    return { points: [] };
  }

  const outerPoints = ringToPathPoints(polygon[0], index, `${baseId}_outer`);
  const subPaths: PathPoint[][] = [];

  for (let i = 1; i < polygon.length; i++) {
    const hole = ringToPathPoints(polygon[i], index, `${baseId}_hole_${i}`);
    if (hole.length >= 3) {
      subPaths.push(hole);
    }
  }

  return {
    points: outerPoints,
    subPaths: subPaths.length > 0 ? subPaths : undefined,
  };
}

/**
 * Execute Boolean Operation on a list of shapes
 */
export function performBooleanOperation(
  operation: BooleanOperation,
  shapes: VectorShape[]
): VectorShape[] {
  if (shapes.length < 2) return shapes;

  const colorPalette = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
  ];

  if (operation === 'divide') {
    // Slices intersecting shapes into constituent non-overlapping pieces
    // For 2 shapes: (A \ B), (B \ A), (A ∩ B)
    const resultShapes: VectorShape[] = [];
    const index = new SourceIndex();
    const s1 = index.addShape(shapes[0]);
    const s2 = index.addShape(shapes[1]);

    const partAOnly = polygonClipping.difference(s1, s2);
    const partBOnly = polygonClipping.difference(s2, s1);
    const partIntersect = polygonClipping.intersection(s1, s2);

    const parts: { mp: MultiPolygon; name: string }[] = [
      { mp: partAOnly, name: `${shapes[0].name} (Divided 1)` },
      { mp: partBOnly, name: `${shapes[1].name} (Divided 2)` },
      { mp: partIntersect, name: 'Divided Intersection' },
    ];

    parts.forEach(({ mp, name }, idx) => {
      mp.forEach((polygon, pIdx) => {
        const id = generateShapeId();
        const { points, subPaths } = polygonToPathPoints(
          polygon,
          `${id}_${idx}_${pIdx}`,
          index
        );
        if (points.length >= 3) {
          resultShapes.push({
            id,
            name: `${name} ${pIdx + 1}`,
            points,
            subPaths,
            closed: true,
            fillColor: colorPalette[(idx + pIdx) % colorPalette.length],
            strokeColor: '#312e81',
            strokeWidth: 0,
            opacity: 1,
            visible: true,
            locked: false,
            isFrameCandidate: true,
          });
        }
      });
    });

    return resultShapes.length > 0 ? resultShapes : [shapes[0]];
  }

  // Union, Subtract, Intersect, Xor
  let multiPolyResult: MultiPolygon;
  const index = new SourceIndex();
  const polyA = index.addShape(shapes[0]);
  const polyB = index.addShape(shapes[1]);

  switch (operation) {
    case 'union':
      multiPolyResult = polygonClipping.union(polyA, polyB);
      break;
    case 'subtract':
      // Bottom shape minus top shape (or first minus second)
      multiPolyResult = polygonClipping.difference(polyA, polyB);
      break;
    case 'intersect':
      multiPolyResult = polygonClipping.intersection(polyA, polyB);
      break;
    case 'xor':
      multiPolyResult = polygonClipping.xor(polyA, polyB);
      break;
  }

  if (!multiPolyResult || multiPolyResult.length === 0) {
    throw new Error(
      `Boolean ${operation} yielded no geometry (shapes might not overlap).`
    );
  }

  const resultShapes: VectorShape[] = [];
  const baseName =
    operation === 'union'
      ? 'Combined Shape'
      : operation === 'subtract'
      ? 'Subtracted Frame'
      : operation === 'intersect'
      ? 'Intersected Frame'
      : 'XOR Frame';

  multiPolyResult.forEach((polygon, idx) => {
    const id = generateShapeId();
    const { points, subPaths } = polygonToPathPoints(
      polygon,
      `${id}_${idx}`,
      index
    );
    if (points.length >= 3) {
      resultShapes.push({
        id,
        name: `${baseName} ${idx + 1}`,
        points,
        subPaths,
        closed: true,
        fillColor: shapes[0].fillColor || '#6366f1',
        strokeColor: shapes[0].strokeColor || '#4338ca',
        strokeWidth: shapes[0].strokeWidth ?? 0,
        opacity: 1,
        visible: true,
        locked: false,
        isFrameCandidate: true,
      });
    }
  });

  return resultShapes;
}

/**
 * Group multiple shapes into a unified compound shape
 */
export function groupShapesIntoCompound(shapes: VectorShape[]): VectorShape {
  if (shapes.length === 0) throw new Error('No shapes to group');
  if (shapes.length === 1) return shapes[0];

  // Try union first
  try {
    const combined = performBooleanOperation('union', shapes);
    if (combined.length > 0) return combined[0];
  } catch (err) {
    // If disjoint, combine into single shape with subPaths
  }

  const primary = shapes[0];
  const id = generateShapeId();
  const subPaths: PathPoint[][] = [];

  if (primary.subPaths) {
    subPaths.push(...primary.subPaths);
  }

  for (let i = 1; i < shapes.length; i++) {
    subPaths.push(shapes[i].points);
    if (shapes[i].subPaths) {
      subPaths.push(...shapes[i].subPaths!);
    }
  }

  return {
    id,
    name: `Grouped Frame (${shapes.length} parts)`,
    points: primary.points,
    subPaths,
    closed: true,
    fillColor: primary.fillColor,
    strokeColor: primary.strokeColor,
    strokeWidth: primary.strokeWidth,
    opacity: 1,
    visible: true,
    locked: false,
    isFrameCandidate: true,
  };
}

/**
 * Flattens all shapes into a single unified non-overlapping compound frame
 */
export function flattenAllShapes(shapes: VectorShape[]): VectorShape {
  const visibleShapes = shapes.filter((s) => s.visible && s.points.length >= 3);
  if (visibleShapes.length === 0) {
    throw new Error('No visible vector shapes to flatten.');
  }
  if (visibleShapes.length === 1) {
    return visibleShapes[0];
  }

  // Progressive union of all shapes, all registered against one index so the
  // final outline can be rebuilt from whichever shape each run came from
  const index = new SourceIndex();
  let accumPoly = index.addShape(visibleShapes[0]);

  for (let i = 1; i < visibleShapes.length; i++) {
    const nextPoly = index.addShape(visibleShapes[i]);
    try {
      accumPoly = polygonClipping.union(accumPoly, nextPoly);
    } catch (e) {
      console.warn('Union error on shape', visibleShapes[i].name, e);
    }
  }

  const id = generateShapeId();
  if (accumPoly.length === 0) {
    return visibleShapes[0];
  }

  // Primary polygon
  const { points, subPaths } = polygonToPathPoints(
    accumPoly[0],
    `${id}_flat`,
    index
  );
  const allSubPaths: PathPoint[][] = subPaths ? [...subPaths] : [];

  // If union resulted in multiple disjoint islands, include remaining islands as subPaths
  for (let i = 1; i < accumPoly.length; i++) {
    const island = polygonToPathPoints(accumPoly[i], `${id}_island_${i}`, index);
    if (island.points.length >= 3) {
      allSubPaths.push(island.points);
    }
    if (island.subPaths) {
      allSubPaths.push(...island.subPaths);
    }
  }

  return {
    id,
    name: 'Unified Canva Frame',
    points,
    subPaths: allSubPaths.length > 0 ? allSubPaths : undefined,
    closed: true,
    fillColor: '#6366f1',
    strokeColor: '#4338ca',
    strokeWidth: 0,
    opacity: 1,
    visible: true,
    locked: false,
    isFrameCandidate: true,
  };
}
