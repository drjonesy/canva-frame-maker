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
