/**
 * Click-to-remove background erasing.
 *
 * A scanline flood fill from the clicked pixel clears everything contiguous and
 * similar in colour, so a background is removed by clicking it rather than by
 * guessing a global threshold. Already-transparent pixels are absorbed too,
 * which lets repeated clicks grow one selection.
 */

/** Squared RGB distance, so the hot loop avoids a square root. */
function colorDistanceSq(
  data: Uint8ClampedArray,
  a: number,
  r: number,
  g: number,
  b: number
): number {
  const dr = data[a] - r;
  const dg = data[a + 1] - g;
  const db = data[a + 2] - b;
  return dr * dr + dg * dg + db * db;
}

export interface FloodRemoveResult {
  /** Pixels cleared by this call. */
  removed: number;
}

/**
 * Clears the region containing (startX, startY) in place.
 *
 * @param tolerance 0-100, how far a pixel's colour may stray and still count as
 *                  background.
 */
export function floodRemoveBackground(
  image: ImageData,
  startX: number,
  startY: number,
  tolerance: number
): FloodRemoveResult {
  const { width, height, data } = image;
  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return { removed: 0 };

  const startIdx = (sy * width + sx) * 4;
  const seedR = data[startIdx];
  const seedG = data[startIdx + 1];
  const seedB = data[startIdx + 2];
  const seedTransparent = data[startIdx + 3] === 0;

  // 100 tolerance spans the full RGB diagonal (255·√3), squared for comparison.
  const maxDist = (tolerance / 100) * 441.67;
  const maxDistSq = maxDist * maxDist;

  const matches = (idx: number) => {
    if (data[idx + 3] === 0) return true; // already cleared
    if (seedTransparent) return false; // seeded on a hole: only absorb holes
    return colorDistanceSq(data, idx, seedR, seedG, seedB) <= maxDistSq;
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [sy * width + sx];
  let removed = 0;

  while (stack.length > 0) {
    const p = stack.pop() as number;
    const y = (p / width) | 0;
    let left = p % width;

    // Walk to the start of this run.
    while (left > 0 && !visited[y * width + left - 1] && matches((y * width + left - 1) * 4)) {
      left--;
    }
    let right = p % width;
    while (
      right < width - 1 &&
      !visited[y * width + right + 1] &&
      matches((y * width + right + 1) * 4)
    ) {
      right++;
    }

    for (let x = left; x <= right; x++) {
      const cell = y * width + x;
      if (visited[cell]) continue;
      visited[cell] = 1;
      if (data[cell * 4 + 3] !== 0) {
        data[cell * 4 + 3] = 0;
        removed++;
      }

      // Seed the rows above and below this run.
      for (const ny of [y - 1, y + 1]) {
        if (ny < 0 || ny >= height) continue;
        const ncell = ny * width + x;
        if (!visited[ncell] && matches(ncell * 4)) stack.push(ncell);
      }
    }
  }

  return { removed };
}

/**
 * Softens the alpha edge left by a flood fill so tracing does not key off a
 * hard staircase. Any opaque pixel touching a cleared one is knocked down to a
 * mid alpha, which the trace threshold then resolves cleanly.
 */
export function featherAlphaEdge(image: ImageData): void {
  const { width, height, data } = image;
  const edges: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] === 0) continue;

      const clearedNeighbour =
        (x > 0 && data[idx - 4 + 3] === 0) ||
        (x < width - 1 && data[idx + 4 + 3] === 0) ||
        (y > 0 && data[idx - width * 4 + 3] === 0) ||
        (y < height - 1 && data[idx + width * 4 + 3] === 0);

      if (clearedNeighbour) edges.push(idx + 3);
    }
  }

  for (const alphaIdx of edges) {
    data[alphaIdx] = Math.min(data[alphaIdx], 128);
  }
}
