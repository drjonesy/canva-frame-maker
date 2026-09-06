import polygonClipping, { MultiPolygon, Polygon, Ring } from 'polygon-clipping';
import { BooleanOperation, PathPoint, VectorShape } from '../types';
import { samplePathToPolygon } from './bezier';
import { generateShapeId } from './shapePresets';

/**
 * Convert a VectorShape into a polygon-clipping MultiPolygon
 */
export function shapeToMultiPolygon(shape: VectorShape): MultiPolygon {
  const outerRing: Ring = samplePathToPolygon(shape.points, shape.closed, 10);
  if (outerRing.length < 3) return [];

  // Ensure ring is closed
  if (
    outerRing[0][0] !== outerRing[outerRing.length - 1][0] ||
    outerRing[0][1] !== outerRing[outerRing.length - 1][1]
  ) {
    outerRing.push([outerRing[0][0], outerRing[0][1]]);
  }

  const rings: Ring[] = [outerRing];

  if (shape.subPaths && shape.subPaths.length > 0) {
    for (const sub of shape.subPaths) {
      const holeRing: Ring = samplePathToPolygon(sub, true, 10);
      if (holeRing.length >= 3) {
        if (
          holeRing[0][0] !== holeRing[holeRing.length - 1][0] ||
          holeRing[0][1] !== holeRing[holeRing.length - 1][1]
        ) {
          holeRing.push([holeRing[0][0], holeRing[0][1]]);
        }
        rings.push(holeRing);
      }
    }
  }

  return [rings];
}

/**
 * Convert a polygon-clipping Polygon into PathPoint[][] (outer ring + holes)
 */
export function polygonToPathPoints(
  polygon: Polygon,
  baseId: string
): { points: PathPoint[]; subPaths?: PathPoint[][] } {
  if (!polygon || polygon.length === 0) {
    return { points: [] };
  }

  function ringToPathPoints(ring: Ring, subId: string): PathPoint[] {
    // Drop the closing duplicated point if present
    const pts = ring.slice(0, -1);
    const result: PathPoint[] = [];

    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const next = pts[(i + 1) % pts.length];

      // Calculate smooth tangent
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      const hDist = Math.min(len * 0.25, 20);

      result.push({
        id: `${subId}_p${i}`,
        x: Math.round(curr[0] * 100) / 100,
        y: Math.round(curr[1] * 100) / 100,
        type: 'rounded',
        cp1: {
          x: Math.round((curr[0] - (dx / len) * hDist) * 100) / 100,
          y: Math.round((curr[1] - (dy / len) * hDist) * 100) / 100,
        },
        cp2: {
          x: Math.round((curr[0] + (dx / len) * hDist) * 100) / 100,
          y: Math.round((curr[1] + (dy / len) * hDist) * 100) / 100,
        },
      });
    }

    return result;
  }

  const outerPoints = ringToPathPoints(polygon[0], `${baseId}_outer`);
  const subPaths: PathPoint[][] = [];

  for (let i = 1; i < polygon.length; i++) {
    const hole = ringToPathPoints(polygon[i], `${baseId}_hole_${i}`);
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
    const s1 = shapeToMultiPolygon(shapes[0]);
    const s2 = shapeToMultiPolygon(shapes[1]);

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
          `${id}_${idx}_${pIdx}`
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
  const polyA = shapeToMultiPolygon(shapes[0]);
  const polyB = shapeToMultiPolygon(shapes[1]);

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
    const { points, subPaths } = polygonToPathPoints(polygon, `${id}_${idx}`);
    if (points.length >= 3) {
      resultShapes.push({
        id,
        name: `${baseName} ${idx + 1}`,
        points,
        subPaths,
        closed: true,
        fillColor: shapes[0].fillColor || '#6366f1',
        strokeColor: shapes[0].strokeColor || '#4338ca',
        strokeWidth: shapes[0].strokeWidth || 2,
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

  // Progressive union of all shapes
  let accumPoly = shapeToMultiPolygon(visibleShapes[0]);

  for (let i = 1; i < visibleShapes.length; i++) {
    const nextPoly = shapeToMultiPolygon(visibleShapes[i]);
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
  const { points, subPaths } = polygonToPathPoints(accumPoly[0], `${id}_flat`);
  const allSubPaths: PathPoint[][] = subPaths ? [...subPaths] : [];

  // If union resulted in multiple disjoint islands, include remaining islands as subPaths
  for (let i = 1; i < accumPoly.length; i++) {
    const island = polygonToPathPoints(accumPoly[i], `${id}_island_${i}`);
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
