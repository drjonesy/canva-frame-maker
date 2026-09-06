import { PathPoint, Point2D, VectorShape } from '../types';

/**
 * Generate SVG Path string 'd' from an array of PathPoints
 */
export function pointsToSvgPath(points: PathPoint[], closed = true): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];

    const cp1 = curr.cp2 || { x: curr.x, y: curr.y };
    const cp2 = next.cp1 || { x: next.x, y: next.y };

    if (!curr.cp2 && !next.cp1) {
      d += ` L ${next.x} ${next.y}`;
    } else {
      d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
    }
  }

  if (closed && points.length > 2) {
    const last = points[points.length - 1];
    const first = points[0];

    const cp1 = last.cp2 || { x: last.x, y: last.y };
    const cp2 = first.cp1 || { x: first.x, y: first.y };

    if (!last.cp2 && !first.cp1) {
      d += ` Z`;
    } else {
      d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${first.x} ${first.y} Z`;
    }
  }

  return d;
}

/**
 * Generate full SVG path string for a shape including any subPaths (holes)
 */
export function shapeToSvgPath(shape: VectorShape): string {
  let main = pointsToSvgPath(shape.points, shape.closed);
  if (shape.subPaths && shape.subPaths.length > 0) {
    for (const sub of shape.subPaths) {
      main += ' ' + pointsToSvgPath(sub, true);
    }
  }
  return main;
}

/**
 * Calculate bounding box [minX, minY, maxX, maxY] for a shape
 */
export function getShapeBounds(shape: VectorShape): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  const allPoints: Point2D[] = [];
  shape.points.forEach((p) => {
    allPoints.push({ x: p.x, y: p.y });
    if (p.cp1) allPoints.push(p.cp1);
    if (p.cp2) allPoints.push(p.cp2);
  });
  if (shape.subPaths) {
    shape.subPaths.forEach((sub) => {
      sub.forEach((p) => {
        allPoints.push({ x: p.x, y: p.y });
        if (p.cp1) allPoints.push(p.cp1);
        if (p.cp2) allPoints.push(p.cp2);
      });
    });
  }

  if (allPoints.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  allPoints.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Sample a cubic Bézier curve segment into discrete points
 */
export function sampleCubicBezier(
  p0: Point2D,
  cp1: Point2D,
  cp2: Point2D,
  p1: Point2D,
  samples = 12
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0.x +
      3 * mt * mt * t * cp1.x +
      3 * mt * t * t * cp2.x +
      t * t * t * p1.x;
    const y =
      mt * mt * mt * p0.y +
      3 * mt * mt * t * cp1.y +
      3 * mt * t * t * cp2.y +
      t * t * t * p1.y;
    points.push([x, y]);
  }
  return points;
}

/**
 * Sample an entire list of PathPoints into a polygon array of [x, y] coordinates
 */
export function samplePathToPolygon(
  points: PathPoint[],
  closed = true,
  stepsPerCurve = 10
): [number, number][] {
  if (points.length === 0) return [];
  if (points.length === 1) return [[points[0].x, points[0].y]];

  const poly: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];

    if (!curr.cp2 && !next.cp1) {
      poly.push([curr.x, curr.y]);
    } else {
      const cp1 = curr.cp2 || { x: curr.x, y: curr.y };
      const cp2 = next.cp1 || { x: next.x, y: next.y };
      const sampled = sampleCubicBezier(curr, cp1, cp2, next, stepsPerCurve);
      // add sampled except the last one (next segment will add it)
      for (let s = 0; s < sampled.length - 1; s++) {
        poly.push(sampled[s]);
      }
    }
  }

  const last = points[points.length - 1];
  poly.push([last.x, last.y]);

  if (closed && points.length > 2) {
    const first = points[0];
    if (last.cp2 || first.cp1) {
      const cp1 = last.cp2 || { x: last.x, y: last.y };
      const cp2 = first.cp1 || { x: first.x, y: first.y };
      const sampled = sampleCubicBezier(last, cp1, cp2, first, stepsPerCurve);
      for (let s = 1; s < sampled.length - 1; s++) {
        poly.push(sampled[s]);
      }
    }
    // Ensure polygon is explicitly closed
    if (poly.length > 0) {
      const start = poly[0];
      const end = poly[poly.length - 1];
      if (start[0] !== end[0] || start[1] !== end[1]) {
        poly.push([start[0], start[1]]);
      }
    }
  }

  return poly;
}

/**
 * Switch a point between 'straight', 'rounded', and 'break'
 */
export function updatePointType(
  point: PathPoint,
  newType: 'straight' | 'rounded' | 'break',
  prevPoint?: PathPoint,
  nextPoint?: PathPoint
): PathPoint {
  const updated = { ...point, type: newType };

  if (newType === 'straight') {
    delete updated.cp1;
    delete updated.cp2;
    return updated;
  }

  if (newType === 'rounded') {
    // If it already has handles, align them collinear with equal distance or smooth direction
    if (updated.cp1 && updated.cp2) {
      // Find average angle
      const dx1 = updated.cp1.x - updated.x;
      const dy1 = updated.cp1.y - updated.y;
      const len1 = Math.hypot(dx1, dy1) || 30;
      const dx2 = updated.cp2.x - updated.x;
      const dy2 = updated.cp2.y - updated.y;
      const len2 = Math.hypot(dx2, dy2) || 30;

      // Angle from cp1 to cp2
      const angle = Math.atan2(dy2 - dy1, dx2 - dx1);
      updated.cp2 = {
        x: updated.x + Math.cos(angle) * len2,
        y: updated.y + Math.sin(angle) * len2,
      };
      updated.cp1 = {
        x: updated.x - Math.cos(angle) * len1,
        y: updated.y - Math.sin(angle) * len1,
      };
    } else {
      // Create default handles tangent to neighboring points
      const pPrev = prevPoint || { x: updated.x - 40, y: updated.y };
      const pNext = nextPoint || { x: updated.x + 40, y: updated.y };
      const dx = pNext.x - pPrev.x;
      const dy = pNext.y - pPrev.y;
      const len = Math.hypot(dx, dy) || 1;
      const handleLen = Math.min(len * 0.25, 40);

      const nx = (dx / len) * handleLen;
      const ny = (dy / len) * handleLen;

      updated.cp1 = { x: updated.x - nx, y: updated.y - ny };
      updated.cp2 = { x: updated.x + nx, y: updated.y + ny };
    }
    return updated;
  }

  if (newType === 'break') {
    // Ensure both handles exist so user can manipulate each independently
    if (!updated.cp1) {
      updated.cp1 = { x: updated.x - 30, y: updated.y };
    }
    if (!updated.cp2) {
      updated.cp2 = { x: updated.x + 30, y: updated.y };
    }
    return updated;
  }

  return updated;
}

/**
 * Reset / Unbreak handles (make them symmetrically balanced)
 */
export function unbreakHandles(point: PathPoint): PathPoint {
  const updated = { ...point, type: 'rounded' as const };
  if (updated.cp2 && !updated.cp1) {
    const dx = updated.cp2.x - updated.x;
    const dy = updated.cp2.y - updated.y;
    updated.cp1 = { x: updated.x - dx, y: updated.y - dy };
  } else if (updated.cp1 && !updated.cp2) {
    const dx = updated.cp1.x - updated.x;
    const dy = updated.cp1.y - updated.y;
    updated.cp2 = { x: updated.x - dx, y: updated.y - dy };
  } else if (updated.cp1 && updated.cp2) {
    const dx = updated.cp2.x - updated.x;
    const dy = updated.cp2.y - updated.y;
    const len = Math.hypot(dx, dy) || 30;
    const angle = Math.atan2(dy, dx);
    updated.cp2 = {
      x: updated.x + Math.cos(angle) * len,
      y: updated.y + Math.sin(angle) * len,
    };
    updated.cp1 = {
      x: updated.x - Math.cos(angle) * len,
      y: updated.y - Math.sin(angle) * len,
    };
  }
  return updated;
}
