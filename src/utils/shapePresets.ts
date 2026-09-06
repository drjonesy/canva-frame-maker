import { PathPoint, ShapePresetType, VectorShape } from '../types';

let shapeIdCounter = 1;

export function generateShapeId(): string {
  return `shape_${Date.now()}_${shapeIdCounter++}`;
}


/**
 * Converts a corner radius percentage into pixels for a given box.
 *
 * 100% is a fully rounded corner — half the shorter side, the point at which
 * adjacent corners meet. Anchoring to the shorter side means stretching one
 * axis leaves the radius alone, so a stadium stays a stadium.
 */
export function cornerRadiusPx(pct: number, width: number, height: number): number {
  const clamped = Math.max(0, Math.min(100, pct));
  return (clamped / 100) * (Math.min(width, height) / 2);
}

/**
 * Corner points for an axis-aligned rectangle.
 *
 * A radius of 0 gives four plain corners; anything larger rounds each one with
 * the standard circle-to-bezier constant. The radius is clamped to half the
 * shorter side, which is the point at which the corners meet.
 */
export function buildRectPoints(
  id: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  radius: number
): PathPoint[] {
  const w = maxX - minX;
  const h = maxY - minY;
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));

  if (r <= 0) {
    return [
      { id: `${id}_p0`, x: minX, y: minY, type: 'straight' },
      { id: `${id}_p1`, x: maxX, y: minY, type: 'straight' },
      { id: `${id}_p2`, x: maxX, y: maxY, type: 'straight' },
      { id: `${id}_p3`, x: minX, y: maxY, type: 'straight' },
    ];
  }

  const k = r * 0.55228;
  return [
    { id: `${id}_p0`, x: minX + r, y: minY, type: 'break', cp1: { x: minX + r - k, y: minY } },
    { id: `${id}_p1`, x: maxX - r, y: minY, type: 'break', cp2: { x: maxX - r + k, y: minY } },
    { id: `${id}_p2`, x: maxX, y: minY + r, type: 'break', cp1: { x: maxX, y: minY + r - k } },
    { id: `${id}_p3`, x: maxX, y: maxY - r, type: 'break', cp2: { x: maxX, y: maxY - r + k } },
    { id: `${id}_p4`, x: maxX - r, y: maxY, type: 'break', cp1: { x: maxX - r + k, y: maxY } },
    { id: `${id}_p5`, x: minX + r, y: maxY, type: 'break', cp2: { x: minX + r - k, y: maxY } },
    { id: `${id}_p6`, x: minX, y: maxY - r, type: 'break', cp1: { x: minX, y: maxY - r + k } },
    { id: `${id}_p7`, x: minX, y: minY + r, type: 'break', cp2: { x: minX, y: minY + r - k } },
  ];
}

export function createPresetShape(
  type: ShapePresetType,
  cx: number,
  cy: number,
  size = 200
): VectorShape {
  const id = generateShapeId();
  const half = size / 2;

  let points: PathPoint[] = [];
  let name = 'Shape';
  let isRect = false;

  switch (type) {
    case 'rect': {
      name = 'Rectangle Frame';
      points = buildRectPoints(id, cx - half, cy - half, cx + half, cy + half, 0);
      isRect = true;
      break;
    }

    case 'circle': {
      name = 'Circle Frame';
      const r = half;
      const k = r * 0.5522847498;
      points = [
        {
          id: `${id}_p0`,
          x: cx,
          y: cy - r,
          type: 'rounded',
          cp1: { x: cx - k, y: cy - r },
          cp2: { x: cx + k, y: cy - r },
        },
        {
          id: `${id}_p1`,
          x: cx + r,
          y: cy,
          type: 'rounded',
          cp1: { x: cx + r, y: cy - k },
          cp2: { x: cx + r, y: cy + k },
        },
        {
          id: `${id}_p2`,
          x: cx,
          y: cy + r,
          type: 'rounded',
          cp1: { x: cx + k, y: cy + r },
          cp2: { x: cx - k, y: cy + r },
        },
        {
          id: `${id}_p3`,
          x: cx - r,
          y: cy,
          type: 'rounded',
          cp1: { x: cx - r, y: cy + k },
          cp2: { x: cx - r, y: cy - k },
        },
      ];
      break;
    }

    case 'triangle': {
      name = 'Triangle Frame';
      points = [
        { id: `${id}_p0`, x: cx, y: cy - half, type: 'straight' },
        { id: `${id}_p1`, x: cx + half, y: cy + half, type: 'straight' },
        { id: `${id}_p2`, x: cx - half, y: cy + half, type: 'straight' },
      ];
      break;
    }

    case 'star': {
      name = 'Star Frame';
      const spikes = 5;
      const outerR = half;
      const innerR = half * 0.42;
      points = [];
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        points.push({
          id: `${id}_p${i}`,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          type: 'straight',
        });
      }
      break;
    }

    case 'heart': {
      name = 'Heart Frame';
      // Smooth Bézier heart shape
      const s = size * 0.009; // scale factor
      points = [
        {
          id: `${id}_p0`,
          x: cx,
          y: cy + 40 * s,
          type: 'rounded',
          cp1: { x: cx - 25 * s, y: cy + 10 * s },
          cp2: { x: cx + 25 * s, y: cy + 10 * s },
        },
        {
          id: `${id}_p1`,
          x: cx + 55 * s,
          y: cy - 20 * s,
          type: 'rounded',
          cp1: { x: cx + 60 * s, y: cy + 5 * s },
          cp2: { x: cx + 45 * s, y: cy - 50 * s },
        },
        {
          id: `${id}_p2`,
          x: cx,
          y: cy - 30 * s,
          type: 'break',
          cp1: { x: cx + 15 * s, y: cy - 50 * s },
          cp2: { x: cx - 15 * s, y: cy - 50 * s },
        },
        {
          id: `${id}_p3`,
          x: cx - 55 * s,
          y: cy - 20 * s,
          type: 'rounded',
          cp1: { x: cx - 45 * s, y: cy - 50 * s },
          cp2: { x: cx - 60 * s, y: cy + 5 * s },
        },
      ];
      break;
    }

    case 'hexagon': {
      name = 'Hexagon Frame';
      points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        points.push({
          id: `${id}_p${i}`,
          x: cx + Math.cos(angle) * half,
          y: cy + Math.sin(angle) * half,
          type: 'straight',
        });
      }
      break;
    }

    case 'arch': {
      name = 'Arch Window Frame';
      const r = half;
      const k = r * 0.55228;
      points = [
        // Bottom-left corner
        { id: `${id}_p0`, x: cx - half, y: cy + half, type: 'straight' },
        // Springing line left
        {
          id: `${id}_p1`,
          x: cx - half,
          y: cy - half * 0.2,
          type: 'break',
          cp2: { x: cx - half, y: cy - half * 0.2 - k },
        },
        // Arch top apex
        {
          id: `${id}_p2`,
          x: cx,
          y: cy - half,
          type: 'rounded',
          cp1: { x: cx - k, y: cy - half },
          cp2: { x: cx + k, y: cy - half },
        },
        // Springing line right
        {
          id: `${id}_p3`,
          x: cx + half,
          y: cy - half * 0.2,
          type: 'break',
          cp1: { x: cx + half, y: cy - half * 0.2 - k },
        },
        // Bottom-right corner
        { id: `${id}_p4`, x: cx + half, y: cy + half, type: 'straight' },
      ];
      break;
    }

    case 'cloud': {
      name = 'Cloud Frame';
      const s = size / 200;
      points = [
        {
          id: `${id}_p0`,
          x: cx - 70 * s,
          y: cy + 30 * s,
          type: 'rounded',
          cp1: { x: cx - 90 * s, y: cy + 30 * s },
          cp2: { x: cx - 90 * s, y: cy - 10 * s },
        },
        {
          id: `${id}_p1`,
          x: cx - 50 * s,
          y: cy - 30 * s,
          type: 'rounded',
          cp1: { x: cx - 80 * s, y: cy - 40 * s },
          cp2: { x: cx - 20 * s, y: cy - 60 * s },
        },
        {
          id: `${id}_p2`,
          x: cx + 20 * s,
          y: cy - 35 * s,
          type: 'rounded',
          cp1: { x: cx, y: cy - 60 * s },
          cp2: { x: cx + 50 * s, y: cy - 50 * s },
        },
        {
          id: `${id}_p3`,
          x: cx + 70 * s,
          y: cy + 10 * s,
          type: 'rounded',
          cp1: { x: cx + 85 * s, y: cy - 20 * s },
          cp2: { x: cx + 90 * s, y: cy + 30 * s },
        },
        {
          id: `${id}_p4`,
          x: cx,
          y: cy + 40 * s,
          type: 'rounded',
          cp1: { x: cx + 40 * s, y: cy + 40 * s },
          cp2: { x: cx - 40 * s, y: cy + 40 * s },
        },
      ];
      break;
    }

    case 'speechBubble': {
      name = 'Speech Bubble Frame';
      const r = half * 0.8;
      points = [
        { id: `${id}_p0`, x: cx - r, y: cy - r * 0.7, type: 'straight' },
        { id: `${id}_p1`, x: cx + r, y: cy - r * 0.7, type: 'straight' },
        { id: `${id}_p2`, x: cx + r, y: cy + r * 0.4, type: 'straight' },
        { id: `${id}_p3`, x: cx - r * 0.2, y: cy + r * 0.4, type: 'straight' },
        { id: `${id}_p4`, x: cx - r * 0.7, y: cy + r, type: 'straight' },
        { id: `${id}_p5`, x: cx - r * 0.5, y: cy + r * 0.4, type: 'straight' },
        { id: `${id}_p6`, x: cx - r, y: cy + r * 0.4, type: 'straight' },
      ];
      break;
    }
  }

  return {
    id,
    name,
    points,
    closed: true,
    fillColor: '#6366f1',
    strokeColor: '#4338ca',
    strokeWidth: 0,
    opacity: 1,
    visible: true,
    locked: false,
    isFrameCandidate: true,
    ...(isRect ? { cornerRadiusPct: 0 } : {}),
  };
}
