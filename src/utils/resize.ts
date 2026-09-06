export type ResizeDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ResizeResult {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  scaleX: number;
  scaleY: number;
}

/** Smallest a shape may be dragged to, in canvas units. */
const MIN_SIZE = 10;

/**
 * Works out the new bounding box for a handle drag.
 *
 * With `keepAspect` (Shift held) one scale factor drives both axes. The edge
 * opposite the grabbed handle stays pinned; an edge handle has no opposite
 * corner on the other axis, so that axis grows about the centre instead.
 */
export function resizeBounds(
  b: Bounds,
  dir: ResizeDir,
  dx: number,
  dy: number,
  keepAspect: boolean
): ResizeResult {
  let minX = b.minX;
  let maxX = b.maxX;
  let minY = b.minY;
  let maxY = b.maxY;

  if (dir.includes('e')) maxX = Math.max(b.minX + MIN_SIZE, b.maxX + dx);
  if (dir.includes('w')) minX = Math.min(b.maxX - MIN_SIZE, b.minX + dx);
  if (dir.includes('s')) maxY = Math.max(b.minY + MIN_SIZE, b.maxY + dy);
  if (dir.includes('n')) minY = Math.min(b.maxY - MIN_SIZE, b.minY + dy);

  let scaleX = b.width > 0 ? (maxX - minX) / b.width : 1;
  let scaleY = b.height > 0 ? (maxY - minY) / b.height : 1;

  if (keepAspect && b.width > 0 && b.height > 0) {
    const movesX = dir.includes('e') || dir.includes('w');
    const movesY = dir.includes('n') || dir.includes('s');
    const s = movesX && movesY ? Math.max(scaleX, scaleY) : movesX ? scaleX : scaleY;

    scaleX = s;
    scaleY = s;
    const w = b.width * s;
    const h = b.height * s;

    if (dir.includes('w')) {
      maxX = b.maxX;
      minX = b.maxX - w;
    } else if (dir.includes('e')) {
      minX = b.minX;
      maxX = b.minX + w;
    } else {
      const cx = (b.minX + b.maxX) / 2;
      minX = cx - w / 2;
      maxX = cx + w / 2;
    }

    if (dir.includes('n')) {
      maxY = b.maxY;
      minY = b.maxY - h;
    } else if (dir.includes('s')) {
      minY = b.minY;
      maxY = b.minY + h;
    } else {
      const cy = (b.minY + b.maxY) / 2;
      minY = cy - h / 2;
      maxY = cy + h / 2;
    }
  }

  return { minX, minY, maxX, maxY, scaleX, scaleY };
}
