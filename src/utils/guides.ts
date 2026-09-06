import { Guide, GuideAxis, VectorShape } from '../types';
import { getShapeBounds } from './bezier';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

let guideSeq = 0;

export function createGuide(axis: GuideAxis, position: number): Guide {
  guideSeq += 1;
  return {
    id: `guide_${Date.now()}_${guideSeq}`,
    axis,
    position: Math.round(position),
  };
}

/** True when a guide already sits on that axis within half a pixel. */
export function guideExistsAt(
  guides: Guide[],
  axis: GuideAxis,
  position: number
): boolean {
  return guides.some(
    (g) => g.axis === axis && Math.abs(g.position - position) < 0.5
  );
}

/**
 * Ruler tick spacing, in canvas units.
 *
 * The step is the smallest "nice" number whose on-screen spacing clears
 * `minPx`, so the labels stay readable and never collide however far the view
 * is zoomed in or out.
 */
const NICE_STEPS = [
  1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000,
];

export function rulerStep(zoom: number, minPx = 64): number {
  for (const step of NICE_STEPS) {
    if (step * zoom >= minPx) return step;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

/** Bounding box enclosing every given shape, or null when there are none. */
export function unionBounds(shapes: VectorShape[]): Bounds | null {
  if (shapes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  shapes.forEach((s) => {
    const b = getShapeBounds(s);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  });

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

export interface SnapResult {
  /** Extra offset to add to the drag so an edge or centre lands on a guide. */
  dx: number;
  dy: number;
  /** Position of the guide that was met, for highlighting it. */
  guideX: number | null;
  guideY: number | null;
}

/**
 * Pull a proposed bounding box onto nearby guides.
 *
 * Each axis is considered separately, and on each axis the three candidates —
 * leading edge, centre, trailing edge — compete for the closest guide within
 * `threshold` canvas units.
 */
export function snapBoundsToGuides(
  b: Bounds,
  guides: Guide[],
  threshold: number
): SnapResult {
  const result: SnapResult = { dx: 0, dy: 0, guideX: null, guideY: null };
  if (guides.length === 0) return result;

  const xCandidates = [b.minX, (b.minX + b.maxX) / 2, b.maxX];
  const yCandidates = [b.minY, (b.minY + b.maxY) / 2, b.maxY];

  let bestX = Infinity;
  let bestY = Infinity;

  guides.forEach((g) => {
    const candidates = g.axis === 'x' ? xCandidates : yCandidates;
    candidates.forEach((c) => {
      const delta = g.position - c;
      const dist = Math.abs(delta);
      if (dist > threshold) return;

      if (g.axis === 'x' && dist < bestX) {
        bestX = dist;
        result.dx = delta;
        result.guideX = g.position;
      } else if (g.axis === 'y' && dist < bestY) {
        bestY = dist;
        result.dy = delta;
        result.guideY = g.position;
      }
    });
  });

  return result;
}
