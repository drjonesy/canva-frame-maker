import { PathPoint, ShapePresetType, VectorShape } from '../types';

let shapeIdCounter = 1;

export function generateShapeId(): string {
  return `shape_${Date.now()}_${shapeIdCounter++}`;
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

  switch (type) {
    case 'rect': {
      name = 'Rectangle Frame';
      points = [
        { id: `${id}_p0`, x: cx - half, y: cy - half, type: 'straight' },
        { id: `${id}_p1`, x: cx + half, y: cy - half, type: 'straight' },
        { id: `${id}_p2`, x: cx + half, y: cy + half, type: 'straight' },
        { id: `${id}_p3`, x: cx - half, y: cy + half, type: 'straight' },
      ];
      break;
    }

    case 'roundedRect': {
      name = 'Rounded Rect Frame';
      const r = size * 0.18;
      const k = r * 0.55228; // standard bezier circle approximation
      points = [
        // Top edge
        {
          id: `${id}_p0`,
          x: cx - half + r,
          y: cy - half,
          type: 'break',
          cp1: { x: cx - half + r - k, y: cy - half },
        },
        {
          id: `${id}_p1`,
          x: cx + half - r,
          y: cy - half,
          type: 'break',
          cp2: { x: cx + half - r + k, y: cy - half },
        },
        // Right edge
        {
          id: `${id}_p2`,
          x: cx + half,
          y: cy - half + r,
          type: 'break',
          cp1: { x: cx + half, y: cy - half + r - k },
        },
        {
          id: `${id}_p3`,
          x: cx + half,
          y: cy + half - r,
          type: 'break',
          cp2: { x: cx + half, y: cy + half - r + k },
        },
        // Bottom edge
        {
          id: `${id}_p4`,
          x: cx + half - r,
          y: cy + half,
          type: 'break',
          cp1: { x: cx + half - r + k, y: cy + half },
        },
        {
          id: `${id}_p5`,
          x: cx - half + r,
          y: cy + half,
          type: 'break',
          cp2: { x: cx - half + r - k, y: cy + half },
        },
        // Left edge
        {
          id: `${id}_p6`,
          x: cx - half,
          y: cy + half - r,
          type: 'break',
          cp1: { x: cx - half, y: cy + half - r + k },
        },
        {
          id: `${id}_p7`,
          x: cx - half,
          y: cy - half + r,
          type: 'break',
          cp2: { x: cx - half, y: cy - half + r - k },
        },
      ];
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
    strokeWidth: 2,
    opacity: 1,
    visible: true,
    locked: false,
    isFrameCandidate: true,
  };
}
