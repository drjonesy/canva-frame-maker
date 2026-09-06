import {
  CanvasDimensions,
  Guide,
  GuideAxis,
  PathPoint,
  Point2D,
  PointType,
  VectorShape,
} from '../types';

/**
 * The `.cf.json` project file — the app's own save format.
 *
 * The SVG export is for Canva and is deliberately lossy: it writes one merged
 * `fill-rule="evenodd"` path with no layer names, no visible/locked flags, no
 * `cornerRadiusPct` and no guides, and re-importing it re-derives anchor types
 * from tangents rather than restoring the ones you set. This file is the
 * editor's in-memory model written out verbatim, so loading it back gives the
 * project exactly as it was left.
 */
export const PROJECT_FILE_FORMAT = 'canva-frame-maker';
export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_EXT = '.cf.json';

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  /** Bumped only when an older file would need converting to load. */
  version: number;
  /** ISO timestamp, for the human reading the file, not for the loader. */
  savedAt: string;
  /** The project's name, which is also the file's basename. */
  name: string;
  dimensions: CanvasDimensions;
  shapes: VectorShape[];
  /** Guides are chrome, but they are part of the working setup worth keeping. */
  guides: Guide[];
}

export interface LoadedProject {
  name: string;
  dimensions: CanvasDimensions;
  shapes: VectorShape[];
  guides: Guide[];
  /** Anything repaired on the way in, for the caller to report. */
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

/**
 * Strip a name down to something safe for a filename, and hand back a fallback
 * when nothing usable is left. Slashes in the preset names ("Instagram Post /
 * Square") would otherwise read as directory separators.
 */
export function sanitizeProjectName(raw: string): string {
  const cleaned = raw
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 80)
    .trim();
  return cleaned || 'untitled-frame';
}

/** `my frame` → `my frame.cf.json`, and an already-suffixed name is left alone. */
export function projectFileName(name: string): string {
  const base = sanitizeProjectName(name);
  return base.toLowerCase().endsWith(PROJECT_FILE_EXT)
    ? base
    : `${base}${PROJECT_FILE_EXT}`;
}

/** `my frame.cf.json` → `my frame`. Also copes with a plain `.json`. */
export function projectNameFromFile(filename: string): string {
  const withoutExt = filename.replace(/\.cf\.json$/i, '').replace(/\.json$/i, '');
  return sanitizeProjectName(withoutExt);
}

export function buildProjectFile(
  name: string,
  dimensions: CanvasDimensions,
  shapes: VectorShape[],
  guides: Guide[]
): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    name: sanitizeProjectName(name),
    dimensions,
    shapes,
    guides,
  };
}

export function serializeProject(project: ProjectFile): string {
  // Indented: a save file you can open in an editor and read is worth the bytes.
  return JSON.stringify(project, null, 2);
}

/** Write the JSON out through a temporary anchor — no backend involved. */
export function downloadProject(project: ProjectFile): void {
  const blob = new Blob([serializeProject(project)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = projectFileName(project.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the click a tick to start before the blob goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

export function isProjectFileName(filename: string): boolean {
  return /\.(cf\.)?json$/i.test(filename);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const num = (v: unknown, fallback: number): number =>
  finite(v) ? v : fallback;

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

const POINT_TYPES: PointType[] = ['straight', 'rounded', 'break'];

function parsePoint2D(v: unknown): Point2D | undefined {
  if (!isObject(v)) return undefined;
  if (!finite(v.x) || !finite(v.y)) return undefined;
  return { x: v.x, y: v.y };
}

/**
 * A point survives only if it has real coordinates; a handle that does not
 * parse is dropped rather than faked, since a zero handle is a different curve.
 */
function parsePathPoint(v: unknown, fallbackId: string): PathPoint | null {
  if (!isObject(v)) return null;
  if (!finite(v.x) || !finite(v.y)) return null;

  const type = POINT_TYPES.includes(v.type as PointType)
    ? (v.type as PointType)
    : 'straight';

  return {
    id: str(v.id, fallbackId) || fallbackId,
    x: v.x,
    y: v.y,
    cp1: parsePoint2D(v.cp1),
    cp2: parsePoint2D(v.cp2),
    type,
  };
}

/**
 * `seen` spans the whole project, not one shape: nudging and point alignment
 * match ids across every shape, so an id shared by two anchors in different
 * layers would move both at once.
 */
function parsePointList(
  v: unknown,
  idPrefix: string,
  seen: Set<string>
): PathPoint[] {
  if (!Array.isArray(v)) return [];
  const out: PathPoint[] = [];

  v.forEach((raw, i) => {
    const point = parsePathPoint(raw, `${idPrefix}_p${i}`);
    if (!point) return;
    if (seen.has(point.id)) point.id = `${idPrefix}_p${i}_${seen.size}`;
    seen.add(point.id);
    out.push(point);
  });

  return out;
}

function parseShape(
  v: unknown,
  index: number,
  seenPointIds: Set<string>
): VectorShape | null {
  if (!isObject(v)) return null;

  const id = str(v.id, `shape_loaded_${index}`) || `shape_loaded_${index}`;
  const points = parsePointList(v.points, id, seenPointIds);
  if (points.length === 0) return null;

  const subPaths = Array.isArray(v.subPaths)
    ? v.subPaths
        .map((sub, i) => parsePointList(sub, `${id}_s${i}`, seenPointIds))
        .filter((sub) => sub.length > 0)
    : undefined;

  const shape: VectorShape = {
    id,
    name: str(v.name, `Layer ${index + 1}`),
    points,
    closed: bool(v.closed, true),
    fillColor: str(v.fillColor, '#F43F5E'),
    strokeColor: str(v.strokeColor, '#000000'),
    // `?? 0` rather than `|| 0`: a legitimate 0 stroke is the app's default.
    strokeWidth: Math.max(0, num(v.strokeWidth, 0)),
    opacity: Math.min(1, Math.max(0, num(v.opacity, 1))),
    visible: bool(v.visible, true),
    locked: bool(v.locked, false),
  };

  if (subPaths && subPaths.length > 0) shape.subPaths = subPaths;
  if (finite(v.cornerRadiusPct)) {
    shape.cornerRadiusPct = Math.min(100, Math.max(0, v.cornerRadiusPct));
  }
  if (typeof v.isFrameCandidate === 'boolean') {
    shape.isFrameCandidate = v.isFrameCandidate;
  }

  return shape;
}

function parseGuide(v: unknown, index: number): Guide | null {
  if (!isObject(v)) return null;
  if (!finite(v.position)) return null;
  const axis: GuideAxis = v.axis === 'x' || v.axis === 'y' ? v.axis : 'x';
  return {
    id: str(v.id, `guide_loaded_${index}`) || `guide_loaded_${index}`,
    axis,
    position: v.position,
  };
}

/**
 * Read a `.cf.json` file back into editor state.
 *
 * Throws only when the file is not a project at all — malformed JSON, or the
 * wrong `format` stamp. Anything else is repaired in place and reported in
 * `warnings`, so one bad layer in a hand-edited file does not cost the project.
 */
export function parseProjectFile(text: string, filename?: string): LoadedProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (!isObject(raw)) {
    throw new Error('This file does not hold a Canva Frame Maker project.');
  }

  if (raw.format !== PROJECT_FILE_FORMAT) {
    throw new Error(
      `This is not a Canva Frame Maker project file (expected "format": "${PROJECT_FILE_FORMAT}").`
    );
  }

  const warnings: string[] = [];

  const version = num(raw.version, 0);
  if (version > PROJECT_FILE_VERSION) {
    warnings.push(
      `Saved by a newer version of the app (file v${version}, this app reads v${PROJECT_FILE_VERSION}). Some settings may be missing.`
    );
  }

  const rawShapes = Array.isArray(raw.shapes) ? raw.shapes : [];
  if (!Array.isArray(raw.shapes)) warnings.push('No layer list found in the file.');

  const seenIds = new Set<string>();
  const seenPointIds = new Set<string>();
  const shapes: VectorShape[] = [];
  rawShapes.forEach((rawShape, i) => {
    const shape = parseShape(rawShape, i, seenPointIds);
    if (!shape) {
      warnings.push(`Layer ${i + 1} had no usable geometry and was skipped.`);
      return;
    }
    // Two layers sharing an id would select, move and delete as one.
    if (seenIds.has(shape.id)) shape.id = `${shape.id}_${i}`;
    seenIds.add(shape.id);
    shapes.push(shape);
  });

  const rawGuides = Array.isArray(raw.guides) ? raw.guides : [];
  const guides = rawGuides
    .map((g, i) => parseGuide(g, i))
    .filter((g): g is Guide => g !== null);

  const dims = isObject(raw.dimensions) ? raw.dimensions : {};
  const dimensions: CanvasDimensions = {
    width: Math.max(1, Math.round(num(dims.width, 1080))),
    height: Math.max(1, Math.round(num(dims.height, 1080))),
    name: typeof dims.name === 'string' ? dims.name : undefined,
  };
  if (!isObject(raw.dimensions)) {
    warnings.push('No canvas size in the file — defaulted to 1080 × 1080.');
  }

  const name = sanitizeProjectName(
    str(raw.name, '') || (filename ? projectNameFromFile(filename) : '')
  );

  return { name, dimensions, shapes, guides, warnings };
}
