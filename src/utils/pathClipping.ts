import { MultiPolygon, Ring } from 'polygon-clipping';
import { PathPoint, VectorShape } from '../types';

/**
 * Curve-preserving bridge between our bezier paths and `polygon-clipping`.
 *
 * The clipper only speaks polygons, so curves have to be flattened on the way
 * in. Rebuilding the result from those flattened points is what wrecked the
 * geometry: it came back as either a smoothed blob or a hundred-anchor
 * polyline of the same arc.
 *
 * So every sample handed to the clipper is remembered here along with the
 * segment and `t` it came from. On the way out each edge of the result ring is
 * matched back to its source segment, consecutive edges from one segment are
 * merged, and that run is re-cut from the *original* cubic (de Casteljau via
 * the blossom). A curve that survived the operation untouched comes back as
 * the very same curve with the very same anchors; only where the two outlines
 * actually crossed does a new anchor appear.
 */

type Pt = [number, number];

/** A single cubic (or straight) segment of a source path. */
interface SourceSegment {
  p0: Pt;
  c1: Pt;
  c2: Pt;
  p3: Pt;
  isLine: boolean;
  /** Index into `SourceIndex.paths`, for finding a segment's neighbours. */
  path: number;
}

interface PathRange {
  start: number;
  count: number;
}

/** Where a flattened point came from. */
interface Sample {
  seg: number;
  t: number;
}

/** One edge of a clipped ring, resolved back onto its source segment. */
interface ResolvedEdge {
  seg: number | null;
  t0: number;
  t1: number;
}

/**
 * Longest chord, in canvas px, between two flattened samples of a curve. The
 * curve itself is restored exactly afterwards, so this only bounds how far a
 * computed crossing can sit from the true one.
 */
const MAX_CHORD = 2;
const MIN_SAMPLES = 8;
const MAX_SAMPLES = 64;

/** Points closer than this are the same point. */
const EPSILON = 1e-9;
/** Grid used to look a clipped vertex back up among the samples. */
const CELL = 1e-4;
/** How far off a curve a crossing may sit before we stop believing it is on it. */
const ON_CURVE_TOLERANCE = 1;

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function cubicAt(seg: SourceSegment, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * seg.p0[0] + b * seg.c1[0] + c * seg.c2[0] + d * seg.p3[0],
    a * seg.p0[1] + b * seg.c1[1] + c * seg.c2[1] + d * seg.p3[1],
  ];
}

/**
 * The cubic blossom f(a,b,c) — the symmetric polynomial whose diagonal is the
 * curve itself. The control points of the sub-curve running from t0 to t1 are
 * f(t0,t0,t0), f(t0,t0,t1), f(t0,t1,t1), f(t1,t1,t1), which holds for t1 < t0
 * too and then simply hands back the sub-curve reversed — exactly what is
 * wanted when the clipper walks a source path backwards.
 */
function blossom(seg: SourceSegment, a: number, b: number, c: number): Pt {
  const w0 = (1 - a) * (1 - b) * (1 - c);
  const w1 =
    a * (1 - b) * (1 - c) + (1 - a) * b * (1 - c) + (1 - a) * (1 - b) * c;
  const w2 = a * b * (1 - c) + a * (1 - b) * c + (1 - a) * b * c;
  const w3 = a * b * c;
  return [
    w0 * seg.p0[0] + w1 * seg.c1[0] + w2 * seg.c2[0] + w3 * seg.p3[0],
    w0 * seg.p0[1] + w1 * seg.c1[1] + w2 * seg.c2[1] + w3 * seg.p3[1],
  ];
}

/** Control handles of the piece of `seg` between t0 and t1. */
function subCurveHandles(
  seg: SourceSegment,
  t0: number,
  t1: number
): { c1: Pt; c2: Pt } {
  return {
    c1: blossom(seg, t0, t0, t1),
    c2: blossom(seg, t0, t1, t1),
  };
}

/** The parameter on `seg` nearest to `xy`, with the endpoints snapped. */
function projectOnto(seg: SourceSegment, xy: Pt): number {
  if (dist(xy, seg.p0) < EPSILON) return 0;
  if (dist(xy, seg.p3) < EPSILON) return 1;

  if (seg.isLine) {
    const dx = seg.p3[0] - seg.p0[0];
    const dy = seg.p3[1] - seg.p0[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < EPSILON) return 0;
    const t = ((xy[0] - seg.p0[0]) * dx + (xy[1] - seg.p0[1]) * dy) / lenSq;
    return Math.min(1, Math.max(0, t));
  }

  // Coarse scan, then a ternary search inside the winning interval
  const steps = 64;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const d = dist(xy, cubicAt(seg, t));
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  let lo = Math.max(0, best - 1 / steps);
  let hi = Math.min(1, best + 1 / steps);
  for (let i = 0; i < 40; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (dist(xy, cubicAt(seg, m1)) < dist(xy, cubicAt(seg, m2))) hi = m2;
    else lo = m1;
  }
  return (lo + hi) / 2;
}

/** How far `xy` sits off `seg`. */
function distanceTo(seg: SourceSegment, xy: Pt): number {
  const t = projectOnto(seg, xy);
  return dist(xy, seg.isLine ? lerp(seg.p0, seg.p3, t) : cubicAt(seg, t));
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Holds the source geometry of everything fed to one clipping operation, so
 * the result can be rebuilt from it.
 */
export class SourceIndex {
  segments: SourceSegment[] = [];
  private paths: PathRange[] = [];
  private cells = new Map<string, { xy: Pt; sample: Sample }[]>();

  /** The segment before `idx` on its own path, wrapping at the ends. */
  prevSegment(idx: number): number {
    const { start, count } = this.paths[this.segments[idx].path];
    return start + ((idx - start - 1 + count) % count);
  }

  /** The segment after `idx` on its own path, wrapping at the ends. */
  nextSegment(idx: number): number {
    const { start, count } = this.paths[this.segments[idx].path];
    return start + ((idx - start + 1) % count);
  }

  private cellKey(x: number, y: number): string {
    return `${Math.round(x / CELL)}:${Math.round(y / CELL)}`;
  }

  private register(xy: Pt, sample: Sample): void {
    const key = this.cellKey(xy[0], xy[1]);
    const bucket = this.cells.get(key);
    if (bucket) bucket.push({ xy, sample });
    else this.cells.set(key, [{ xy, sample }]);
  }

  /**
   * Every source sample sitting on `xy`. Usually one; two source paths can
   * share a coordinate, which is why this returns a list.
   */
  lookup(xy: Pt): Sample[] {
    const found: Sample[] = [];
    const cx = Math.round(xy[0] / CELL);
    const cy = Math.round(xy[1] / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.cells.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const entry of bucket) {
          if (dist(entry.xy, xy) < CELL) found.push(entry.sample);
        }
      }
    }
    return found;
  }

  /**
   * Flatten one path into a clipper ring, remembering where each point came
   * from. Straight segments contribute their start point only — the clipper
   * handles a straight edge exactly, so sampling one would just litter the
   * result with anchors.
   */
  addPath(points: PathPoint[], closed: boolean): Ring {
    const n = points.length;
    if (n < 3) return [];

    const start = this.segments.length;
    const pathIdx = this.paths.length;

    for (let i = 0; i < n; i++) {
      const curr = points[i];
      const next = points[(i + 1) % n];
      // An open path is closed off with a straight line, as the renderer does
      const useHandles = i < n - 1 || closed;
      const c1 = useHandles ? curr.cp2 : undefined;
      const c2 = useHandles ? next.cp1 : undefined;
      this.segments.push({
        p0: [curr.x, curr.y],
        c1: c1 ? [c1.x, c1.y] : [curr.x, curr.y],
        c2: c2 ? [c2.x, c2.y] : [next.x, next.y],
        p3: [next.x, next.y],
        isLine: !c1 && !c2,
        path: pathIdx,
      });
    }
    this.paths.push({ start, count: n });

    const ring: Ring = [];
    for (let i = 0; i < n; i++) {
      const idx = start + i;
      const seg = this.segments[idx];
      const steps = seg.isLine ? 1 : sampleCount(seg);
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const xy: Pt = k === 0 ? [seg.p0[0], seg.p0[1]] : cubicAt(seg, t);
        this.register(xy, { seg: idx, t });
        ring.push(xy);
      }
    }
    ring.push([ring[0][0], ring[0][1]]);
    return ring;
  }

  /** Flatten a whole shape — outline plus holes — into one MultiPolygon. */
  addShape(shape: VectorShape): MultiPolygon {
    const outer = this.addPath(shape.points, shape.closed);
    if (outer.length < 4) return [];
    const rings: Ring[] = [outer];
    for (const sub of shape.subPaths ?? []) {
      const hole = this.addPath(sub, true);
      if (hole.length >= 4) rings.push(hole);
    }
    return [rings];
  }
}

/** Samples for one curve: enough that no chord runs longer than MAX_CHORD. */
function sampleCount(seg: SourceSegment): number {
  const approxLength =
    dist(seg.p0, seg.c1) + dist(seg.c1, seg.c2) + dist(seg.c2, seg.p3);
  return Math.min(
    MAX_SAMPLES,
    Math.max(MIN_SAMPLES, Math.ceil(approxLength / MAX_CHORD))
  );
}

/** Drop the closing repeat and any coincident neighbours. */
function dedupe(ring: Ring): Pt[] {
  const pts: Pt[] = [];
  for (const [x, y] of ring) {
    const last = pts[pts.length - 1];
    if (!last || dist(last, [x, y]) > EPSILON) pts.push([x, y]);
  }
  while (pts.length > 1 && dist(pts[0], pts[pts.length - 1]) < EPSILON) {
    pts.pop();
  }
  return pts;
}

/**
 * Work out which source segment the edge from `a` to `b` runs along.
 *
 * Both ends are usually remembered samples, in which case they either share a
 * segment or sit either side of an anchor. A crossing introduced by the clip
 * is remembered by nobody, so it is placed by asking which of the few
 * plausible segments actually passes through it.
 */
function resolveEdge(
  index: SourceIndex,
  a: Pt,
  b: Pt,
  aSample: Sample | null,
  bSample: Sample | null
): ResolvedEdge {
  if (aSample && bSample) {
    if (aSample.seg === bSample.seg) {
      return { seg: aSample.seg, t0: aSample.t, t1: bSample.t };
    }
    // An anchor is only ever recorded as the start of its outgoing segment,
    // so crossing one shows up as a step to the neighbouring segment.
    if (index.nextSegment(aSample.seg) === bSample.seg && bSample.t === 0) {
      return { seg: aSample.seg, t0: aSample.t, t1: 1 };
    }
    if (index.nextSegment(bSample.seg) === aSample.seg && aSample.t === 0) {
      return { seg: bSample.seg, t0: 1, t1: bSample.t };
    }
  }

  const candidates: number[] = [];
  const add = (seg: number | null) => {
    if (seg !== null && !candidates.includes(seg)) candidates.push(seg);
  };
  if (aSample) {
    add(aSample.seg);
    if (aSample.t === 0) add(index.prevSegment(aSample.seg));
  }
  if (bSample) {
    add(bSample.seg);
    if (bSample.t === 0) add(index.prevSegment(bSample.seg));
  }

  let best: number | null = null;
  let bestD = ON_CURVE_TOLERANCE;
  for (const seg of candidates) {
    const source = index.segments[seg];
    const d = Math.max(distanceTo(source, a), distanceTo(source, b));
    if (d < bestD) {
      bestD = d;
      best = seg;
    }
  }
  if (best === null) return { seg: null, t0: 0, t1: 1 };

  const source = index.segments[best];
  return {
    seg: best,
    t0: aSample?.seg === best ? aSample.t : projectOnto(source, a),
    t1: bSample?.seg === best ? bSample.t : projectOnto(source, b),
  };
}

/** One segment of the rebuilt outline: a line, or a cubic with its handles. */
interface Piece {
  start: Pt;
  end: Pt;
  c1?: Pt;
  c2?: Pt;
}

/** Rough length of a piece — good enough to pick the longest of two. */
function pieceLength(piece: Piece): number {
  if (!piece.c1 || !piece.c2) return dist(piece.start, piece.end);
  return (
    dist(piece.start, piece.c1) +
    dist(piece.c1, piece.c2) +
    dist(piece.c2, piece.end)
  );
}

/** Split a piece in half at its midpoint (de Casteljau), keeping its shape. */
function halvePiece(piece: Piece): [Piece, Piece] {
  if (!piece.c1 || !piece.c2) {
    const mid = lerp(piece.start, piece.end, 0.5);
    return [
      { start: piece.start, end: mid },
      { start: mid, end: piece.end },
    ];
  }
  const a = lerp(piece.start, piece.c1, 0.5);
  const b = lerp(piece.c1, piece.c2, 0.5);
  const c = lerp(piece.c2, piece.end, 0.5);
  const d = lerp(a, b, 0.5);
  const e = lerp(b, c, 0.5);
  const mid = lerp(d, e, 0.5);
  return [
    { start: piece.start, c1: a, c2: d, end: mid },
    { start: mid, c1: e, c2: c, end: piece.end },
  ];
}

/**
 * Two edges of the ring belong to the same piece when they run along the same
 * source segment and meet at the same parameter on it.
 */
function continuous(prev: ResolvedEdge, next: ResolvedEdge): boolean {
  return (
    prev.seg !== null &&
    prev.seg === next.seg &&
    Math.abs(prev.t1 - next.t0) < 1e-7
  );
}

function classify(
  cp1: { x: number; y: number } | undefined,
  cp2: { x: number; y: number } | undefined,
  x: number,
  y: number
): PathPoint['type'] {
  if (!cp1 && !cp2) return 'straight';
  if (!cp1 || !cp2) return 'break';
  // Collinear handles on opposite sides of the anchor are a smooth join
  const ax = x - cp1.x;
  const ay = y - cp1.y;
  const bx = cp2.x - x;
  const by = cp2.y - y;
  const cross = ax * by - ay * bx;
  const scale = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (scale < EPSILON) return 'break';
  return Math.abs(cross) / scale < 1e-4 ? 'rounded' : 'break';
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Rebuild one clipped ring as bezier PathPoints, restoring the curves it was
 * cut from.
 */
export function ringToPathPoints(
  ring: Ring,
  index: SourceIndex,
  baseId: string
): PathPoint[] {
  const verts = dedupe(ring);
  const n = verts.length;
  if (n < 3) return [];

  // Which source sample, if any, each vertex is
  const samples: (Sample | null)[] = verts.map(() => null);
  const candidates = verts.map((v) => index.lookup(v));
  for (let i = 0; i < n; i++) {
    if (candidates[i].length === 1) samples[i] = candidates[i][0];
  }
  for (let i = 0; i < n; i++) {
    if (samples[i] || candidates[i].length === 0) continue;
    // Ambiguous only when two source paths share a coordinate; prefer the one
    // on the same path as a settled neighbour.
    const near = [samples[(i - 1 + n) % n], samples[(i + 1) % n]].filter(
      Boolean
    ) as Sample[];
    samples[i] =
      candidates[i].find((c) =>
        near.some(
          (s) =>
            index.segments[s.seg].path === index.segments[c.seg].path
        )
      ) ?? candidates[i][0];
  }

  const edges: ResolvedEdge[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    edges.push(resolveEdge(index, verts[i], verts[j], samples[i], samples[j]));
  }

  // Start the sweep where one piece ends and the next begins, so a run that
  // straddles the ring's arbitrary first vertex is still merged into one.
  let startEdge = 0;
  for (let i = 0; i < n; i++) {
    if (!continuous(edges[(i - 1 + n) % n], edges[i])) {
      startEdge = i;
      break;
    }
  }

  const pieces: Piece[] = [];

  let k = 0;
  while (k < n) {
    const first = (startEdge + k) % n;
    let last = first;
    let span = 1;
    while (span < n) {
      const nextEdge = (first + span) % n;
      if (!continuous(edges[last], edges[nextEdge])) break;
      last = nextEdge;
      span++;
    }

    const edge = edges[first];
    const startPt = verts[first];
    const endPt = verts[(last + 1) % n];

    if (edge.seg === null || index.segments[edge.seg].isLine) {
      pieces.push({ start: startPt, end: endPt });
    } else {
      const seg = index.segments[edge.seg];
      const { c1, c2 } = subCurveHandles(seg, edge.t0, edges[last].t1);
      pieces.push({ start: startPt, end: endPt, c1, c2 });
    }

    k += span;
  }

  // A lens — two arcs meeting at two crossings — is a legitimate result, but a
  // two-anchor path has no closing segment in our renderer. Halve the longest
  // pieces until there are three anchors to close over.
  while (pieces.length > 0 && pieces.length < 3) {
    let longest = 0;
    for (let i = 1; i < pieces.length; i++) {
      if (pieceLength(pieces[i]) > pieceLength(pieces[longest])) longest = i;
    }
    pieces.splice(longest, 1, ...halvePiece(pieces[longest]));
  }
  if (pieces.length < 3) return [];

  return pieces.map((piece, i) => {
    const prev = pieces[(i - 1 + pieces.length) % pieces.length];
    const x = round(piece.start[0]);
    const y = round(piece.start[1]);
    const cp1 = prev.c2
      ? { x: round(prev.c2[0]), y: round(prev.c2[1]) }
      : undefined;
    const cp2 = piece.c1
      ? { x: round(piece.c1[0]), y: round(piece.c1[1]) }
      : undefined;
    return {
      id: `${baseId}_p${i}`,
      x,
      y,
      cp1,
      cp2,
      type: classify(cp1, cp2, x, y),
    };
  });
}
