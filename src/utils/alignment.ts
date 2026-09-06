import { PathPoint, VectorShape } from '../types';
import { getShapeBounds } from './bezier';

export type ObjectAlignType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'distributeH'
  | 'distributeV';

export type PointAlignType =
  | 'left'
  | 'centerX'
  | 'right'
  | 'top'
  | 'centerY'
  | 'bottom';

/**
 * Align multiple VectorShapes
 */
export function alignShapes(
  shapes: VectorShape[],
  selectedIds: string[],
  alignType: ObjectAlignType
): VectorShape[] {
  if (selectedIds.length < 2) return shapes;

  const targetShapes = shapes.filter((s) => selectedIds.includes(s.id));
  const boundsList = targetShapes.map((s) => ({
    shape: s,
    b: getShapeBounds(s),
  }));

  let targetX = 0;
  let targetY = 0;

  const allMinX = Math.min(...boundsList.map((i) => i.b.minX));
  const allMaxX = Math.max(...boundsList.map((i) => i.b.maxX));
  const allMinY = Math.min(...boundsList.map((i) => i.b.minY));
  const allMaxY = Math.max(...boundsList.map((i) => i.b.maxY));

  switch (alignType) {
    case 'left':
      targetX = allMinX;
      break;
    case 'center':
      targetX = (allMinX + allMaxX) / 2;
      break;
    case 'right':
      targetX = allMaxX;
      break;
    case 'top':
      targetY = allMinY;
      break;
    case 'middle':
      targetY = (allMinY + allMaxY) / 2;
      break;
    case 'bottom':
      targetY = allMaxY;
      break;
    case 'distributeH': {
      // Sort by minX
      const sorted = [...boundsList].sort((a, b) => a.b.minX - b.b.minX);
      if (sorted.length <= 2) return shapes;
      const totalWidth =
        sorted[sorted.length - 1].b.maxX - sorted[0].b.minX;
      const shapesWidthSum = sorted.reduce(
        (sum, item) => sum + item.b.width,
        0
      );
      const gap =
        Math.max(0, totalWidth - shapesWidthSum) / (sorted.length - 1);

      let currentX = sorted[0].b.minX;
      const shiftMap = new Map<string, { dx: number; dy: number }>();

      sorted.forEach((item) => {
        const dx = currentX - item.b.minX;
        shiftMap.set(item.shape.id, { dx, dy: 0 });
        currentX += item.b.width + gap;
      });

      return shapes.map((s) => {
        const shift = shiftMap.get(s.id);
        if (!shift) return s;
        return translateShape(s, shift.dx, shift.dy);
      });
    }
    case 'distributeV': {
      const sorted = [...boundsList].sort((a, b) => a.b.minY - b.b.minY);
      if (sorted.length <= 2) return shapes;
      const totalHeight =
        sorted[sorted.length - 1].b.maxY - sorted[0].b.minY;
      const shapesHeightSum = sorted.reduce(
        (sum, item) => sum + item.b.height,
        0
      );
      const gap =
        Math.max(0, totalHeight - shapesHeightSum) / (sorted.length - 1);

      let currentY = sorted[0].b.minY;
      const shiftMap = new Map<string, { dx: number; dy: number }>();

      sorted.forEach((item) => {
        const dy = currentY - item.b.minY;
        shiftMap.set(item.shape.id, { dx: 0, dy });
        currentY += item.b.height + gap;
      });

      return shapes.map((s) => {
        const shift = shiftMap.get(s.id);
        if (!shift) return s;
        return translateShape(s, shift.dx, shift.dy);
      });
    }
  }

  return shapes.map((shape) => {
    if (!selectedIds.includes(shape.id)) return shape;
    const b = getShapeBounds(shape);
    let dx = 0;
    let dy = 0;

    if (alignType === 'left') dx = targetX - b.minX;
    else if (alignType === 'center') dx = targetX - (b.minX + b.maxX) / 2;
    else if (alignType === 'right') dx = targetX - b.maxX;
    else if (alignType === 'top') dy = targetY - b.minY;
    else if (alignType === 'middle') dy = targetY - (b.minY + b.maxY) / 2;
    else if (alignType === 'bottom') dy = targetY - b.maxY;

    return translateShape(shape, dx, dy);
  });
}

function translateShape(shape: VectorShape, dx: number, dy: number): VectorShape {
  if (dx === 0 && dy === 0) return shape;

  function translatePoints(pts: PathPoint[]): PathPoint[] {
    return pts.map((p) => ({
      ...p,
      x: p.x + dx,
      y: p.y + dy,
      cp1: p.cp1 ? { x: p.cp1.x + dx, y: p.cp1.y + dy } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x + dx, y: p.cp2.y + dy } : undefined,
    }));
  }

  return {
    ...shape,
    points: translatePoints(shape.points),
    subPaths: shape.subPaths ? shape.subPaths.map(translatePoints) : undefined,
  };
}

/**
 * Align dots / anchor points within an active shape or selection
 */
export function alignPoints(
  points: PathPoint[],
  selectedPointIds: string[],
  alignType: PointAlignType
): PathPoint[] {
  if (selectedPointIds.length < 2) return points;

  const targetPoints = points.filter((p) => selectedPointIds.includes(p.id));

  let targetVal = 0;
  if (alignType === 'left') {
    targetVal = Math.min(...targetPoints.map((p) => p.x));
  } else if (alignType === 'centerX') {
    targetVal =
      targetPoints.reduce((acc, p) => acc + p.x, 0) / targetPoints.length;
  } else if (alignType === 'right') {
    targetVal = Math.max(...targetPoints.map((p) => p.x));
  } else if (alignType === 'top') {
    targetVal = Math.min(...targetPoints.map((p) => p.y));
  } else if (alignType === 'centerY') {
    targetVal =
      targetPoints.reduce((acc, p) => acc + p.y, 0) / targetPoints.length;
  } else if (alignType === 'bottom') {
    targetVal = Math.max(...targetPoints.map((p) => p.y));
  }

  return points.map((p) => {
    if (!selectedPointIds.includes(p.id)) return p;

    const updated = { ...p };
    const dx =
      alignType === 'left' || alignType === 'centerX' || alignType === 'right'
        ? targetVal - p.x
        : 0;
    const dy =
      alignType === 'top' || alignType === 'centerY' || alignType === 'bottom'
        ? targetVal - p.y
        : 0;

    updated.x += dx;
    updated.y += dy;
    if (updated.cp1) {
      updated.cp1 = { x: updated.cp1.x + dx, y: updated.cp1.y + dy };
    }
    if (updated.cp2) {
      updated.cp2 = { x: updated.cp2.x + dx, y: updated.cp2.y + dy };
    }

    return updated;
  });
}
