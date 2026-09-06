import { PathPoint, VectorShape } from '../types';
import { translateShape } from './alignment';

export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

/** Smallest and largest step the panel will accept, in canvas units. */
export const NUDGE_MIN_STEP = 0.1;
export const NUDGE_MAX_STEP = 1000;
export const NUDGE_DEFAULT_STEP = 1;

/** Holding Shift moves by this many steps at once. */
export const NUDGE_SHIFT_MULTIPLIER = 10;

/**
 * Arrow presses closer together than this collapse into a single undo step, so
 * walking a shape across the canvas does not bury the history under one entry
 * per key repeat.
 */
export const NUDGE_HISTORY_GAP_MS = 700;

export function clampNudgeStep(step: number): number {
  if (!Number.isFinite(step)) return NUDGE_DEFAULT_STEP;
  return Math.min(NUDGE_MAX_STEP, Math.max(NUDGE_MIN_STEP, step));
}

const ARROW_KEYS: Record<string, NudgeDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** The direction an arrow key means, or null for any other key. */
export function directionFromKey(key: string): NudgeDirection | null {
  return ARROW_KEYS[key] ?? null;
}

/** Canvas y grows downwards, so "up" is a negative dy. */
export function nudgeDelta(
  direction: NudgeDirection,
  step: number
): { dx: number; dy: number } {
  switch (direction) {
    case 'up':
      return { dx: 0, dy: -step };
    case 'down':
      return { dx: 0, dy: step };
    case 'left':
      return { dx: -step, dy: 0 };
    case 'right':
      return { dx: step, dy: 0 };
  }
}

/**
 * Move the selected shapes by (dx, dy). Locked shapes are left alone — they
 * cannot be dragged on the canvas either, so the keyboard must not be a way
 * around the lock.
 */
export function nudgeShapes(
  shapes: VectorShape[],
  selectedIds: string[],
  dx: number,
  dy: number
): VectorShape[] {
  if (selectedIds.length === 0 || (dx === 0 && dy === 0)) return shapes;
  return shapes.map((s) =>
    selectedIds.includes(s.id) && !s.locked ? translateShape(s, dx, dy) : s
  );
}

/** Move the selected anchor points — and their handles — by (dx, dy). */
export function nudgePoints(
  points: PathPoint[],
  selectedPointIds: string[],
  dx: number,
  dy: number
): PathPoint[] {
  if (selectedPointIds.length === 0 || (dx === 0 && dy === 0)) return points;
  // Hand the same array back when this path holds none of the selected points,
  // so the caller can leave that shape's object identity alone.
  if (!points.some((p) => selectedPointIds.includes(p.id))) return points;

  return points.map((p) => {
    if (!selectedPointIds.includes(p.id)) return p;
    return {
      ...p,
      x: p.x + dx,
      y: p.y + dy,
      cp1: p.cp1 ? { x: p.cp1.x + dx, y: p.cp1.y + dy } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x + dx, y: p.cp2.y + dy } : undefined,
    };
  });
}
