export type PointType = 'straight' | 'rounded' | 'break';

export interface Point2D {
  x: number;
  y: number;
}

export interface PathPoint {
  id: string;
  x: number;
  y: number;
  // Handle in (control point 1 - incoming)
  cp1?: Point2D;
  // Handle out (control point 2 - outgoing)
  cp2?: Point2D;
  type: PointType;
}

/**
 * What a text layer is set in, and what it says.
 *
 * A text layer's `points` are ordinary outlines — everything downstream treats
 * it as any other shape — but they are *derived* from this, rebuilt whenever a
 * setting here changes. That makes the descriptor the source of truth and the
 * anchors a view of it, so anything that edits those anchors by another route
 * has to drop the descriptor first (`detachText` in `utils/textToShape.ts`).
 */
export interface TextStyle {
  /** What is typed. `\n` starts a new line. */
  content: string;
  /** A Google Fonts family name, as it appears in `data/googleFonts.ts`. */
  fontFamily: string;
  /** Em size in canvas px. */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  /** Extra space *between* characters, in canvas px. Negative tightens. */
  letterSpacing: number;
  /** Baseline-to-baseline distance as a multiple of `fontSize`. */
  lineHeight: number;
  underline: boolean;
  overline: boolean;
  lineThrough: boolean;
  /** Left edge of the first character, in canvas coordinates. */
  x: number;
  /** Top of the first line's ascent, in canvas coordinates. */
  y: number;
}

export interface VectorShape {
  id: string;
  name: string;
  points: PathPoint[];
  closed: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  // Optional compound paths (holes or sub-polygons)
  subPaths?: PathPoint[][];
  // Present on rectangles: corner radius as 0-100% of half the shorter side,
  // so the corners stay put when one axis is stretched
  cornerRadiusPct?: number;
  // Present on text layers: the settings the outlines above were built from,
  // which is what keeps a typed word re-editable rather than frozen geometry
  text?: TextStyle;
  // Transformed origin or bounds
  isFrameCandidate?: boolean;
}

export interface CanvasDimensions {
  width: number;
  height: number;
  name?: string;
}

export type ToolMode = 
  | 'select'       // Object selection & transform
  | 'directSelect' // Point & handle manipulation (sub-selection)
  | 'pen'          // Pen tool drawing
  | 'addPoint'     // Drop anchors onto an existing outline
  | 'text'         // Place and type an editable text layer
  | 'pan';         // Canvas pan

export type ShapePresetType = 
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'heart'
  | 'hexagon'
  | 'cloud'
  | 'arch'
  | 'speechBubble';

export type BooleanOperation = 'union' | 'subtract' | 'intersect' | 'xor' | 'divide';

export interface OverlayCollision {
  layer1Id: string;
  layer1Name: string;
  layer2Id: string;
  layer2Name: string;
}

export interface OverlayCheckResult {
  hasOverlay: boolean;
  collisions: OverlayCollision[];
}

/**
 * Whether the exported page clears Canva's minimum import size.
 * `tooSmall` will be rejected by Canva; `tight` imports but only just.
 */
export interface ImportSizeCheckResult {
  status: 'empty' | 'tooSmall' | 'tight' | 'ok';
  /** The exported page, in px — the artwork's bounding box, not the canvas. */
  width: number;
  height: number;
  smallestSide: number;
  minimum: number;
  /** Factor that would lift the smallest side clear of the minimum. */
  suggestedScale: number;
  suggestedWidth: number;
  suggestedHeight: number;
}

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

/** A vertical guide lives on the `x` axis; a horizontal guide on `y`. */
export type GuideAxis = 'x' | 'y';

export interface Guide {
  id: string;
  axis: GuideAxis;
  /** Canvas coordinate the line sits at, on the guide's own axis. */
  position: number;
}

/** Where a shape's bounding box meets the guide. */
export type GuideAlignType =
  | 'left'
  | 'centerX'
  | 'right'
  | 'top'
  | 'centerY'
  | 'bottom';

export interface HistoryEntry {
  shapes: VectorShape[];
  canvasWidth: number;
  canvasHeight: number;
}
