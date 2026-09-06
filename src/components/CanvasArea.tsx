import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  CanvasDimensions,
  Guide,
  GuideAxis,
  PathPoint,
  Point2D,
  ToolMode,
  VectorShape,
} from '../types';
import { resizeBounds, ResizeDir } from '../utils/resize';
import {
  normalizeAngle,
  pointerAngle,
  rotateShapes,
  snapAngle,
} from '../utils/rotate';
import { buildRectPoints, cornerRadiusPx } from '../utils/shapePresets';
import { createGuide, snapBoundsToGuides, unionBounds } from '../utils/guides';
import {
  getShapeBounds,
  pointsToSvgPath,
  shapeToSvgPath,
} from '../utils/bezier';
import { Rulers, RULER_SIZE } from './Rulers';

interface Props {
  dimensions: CanvasDimensions;
  shapes: VectorShape[];
  selectedShapeIds: string[];
  selectedPointIds: string[];
  currentTool: ToolMode;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  fitSignal: number;
  guides: Guide[];
  selectedGuideIds: string[];
  showRulers: boolean;
  showGuides: boolean;
  snapToGuides: boolean;
  onAddGuide: (guide: Guide) => void;
  onUpdateGuide: (id: string, position: number) => void;
  onDeleteGuide: (id: string) => void;
  onSelectGuide: (id: string, multi: boolean) => void;
  onSelectShape: (id: string, multi: boolean) => void;
  onClearSelection: () => void;
  onSelectPoint: (id: string, multi: boolean) => void;
  onUpdateShapes: (updated: VectorShape[]) => void;
  onUpdateActivePoints: (updatedPoints: PathPoint[], isClosed?: boolean) => void;
  onFinishPath: () => void;
  /**
   * Fired once per drag, on the first movement rather than on mouse down, so a
   * bare click that changes nothing does not leave an empty undo step behind.
   */
  onBeginTransform: () => void;
}

/**
 * SVG elements resolve `scale` against the viewBox, not their own box, so a
 * hover grow flings the dot away from the pointer — which ends the hover, which
 * snaps it back under the pointer, which starts it again. Anchoring the scale
 * to the element's own box keeps it centred and the cursor steady.
 */
/** Each bounding-box handle points along the axis it actually resizes. */
const RESIZE_CURSORS: Record<string, string> = {
  nw: 'cursor-nwse-resize',
  se: 'cursor-nwse-resize',
  ne: 'cursor-nesw-resize',
  sw: 'cursor-nesw-resize',
  n: 'cursor-ns-resize',
  s: 'cursor-ns-resize',
  e: 'cursor-ew-resize',
  w: 'cursor-ew-resize',
};

const HOVER_GROW_ORIGIN: React.CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: 'center',
};

/** Guide chrome: cyan when idle, the selection rose when picked or snapped to. */
const GUIDE_COLOR = '#06B6D4';
const GUIDE_ACTIVE_COLOR = '#F43F5E';

/** How close, in screen pixels, a dragged shape has to come to snap to a guide. */
const SNAP_PX = 6;

export const CanvasArea: React.FC<Props> = ({
  dimensions,
  shapes,
  selectedShapeIds,
  selectedPointIds,
  currentTool,
  zoom,
  onZoomChange,
  fitSignal,
  guides,
  selectedGuideIds,
  showRulers,
  showGuides,
  snapToGuides,
  onAddGuide,
  onUpdateGuide,
  onDeleteGuide,
  onSelectGuide,
  onSelectShape,
  onClearSelection,
  onSelectPoint,
  onUpdateShapes,
  onUpdateActivePoints,
  onFinishPath,
  onBeginTransform,
}) => {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  // Mouse drag interaction states
  const [dragTarget, setDragTarget] = useState<{
    type: 'shape' | 'point' | 'handle1' | 'handle2' | 'resize' | 'rotate';
    shapeId: string;
    pointId?: string;
    handleType?: 'cp1' | 'cp2';
    resizeDir?: ResizeDir;
    startX: number;
    startY: number;
    initialShapes: VectorShape[];
    initialPoints?: PathPoint[];
    initialBounds?: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
    /** Rotation pivot, frozen at mouse down so it cannot drift as the box turns. */
    center?: Point2D;
    /** Where the pointer sat, in degrees about `center`, when the drag began. */
    startAngle?: number;
  } | null>(null);

  // History is pushed on the first movement of a drag, not on mouse down, so
  // clicking a shape without moving it does not stack up empty undo steps.
  const transformRecorded = useRef(false);

  // Live rotation, in degrees, for the readout beside the handle.
  const [rotatePreview, setRotatePreview] = useState<number | null>(null);

  // A guide being dragged, whether pulled fresh off a ruler or picked up on
  // the canvas. Kept apart from dragTarget, which is always about a shape.
  const [guideDrag, setGuideDrag] = useState<{ id: string; axis: GuideAxis } | null>(
    null
  );

  // Guide positions the current drag is snapped to, so they can light up.
  const [snapHit, setSnapHit] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });

  // Viewport size in screen pixels. The rulers need it to lay out their ticks,
  // and the guides to know how far to run across the visible area.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // Live mouse position in canvas coordinates
  const [mouseCanvasPos, setMouseCanvasPos] = useState<Point2D>({ x: 0, y: 0 });

  // Currently active shape being edited or drawn
  const activeShape = shapes.find((s) => selectedShapeIds.includes(s.id));

  // Convert browser client coords to canvas coordinates
  const clientToCanvas = useCallback(
    (clientX: number, clientY: number): Point2D => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2 + pan.x;
      const centerY = rect.height / 2 + pan.y;

      const relX = clientX - rect.left - centerX;
      const relY = clientY - rect.top - centerY;

      const canvasX = relX / zoom + dimensions.width / 2;
      const canvasY = relY / zoom + dimensions.height / 2;

      return { x: canvasX, y: canvasY };
    },
    [dimensions, pan, zoom]
  );

  // Key handlers for Space (Pan), Escape/Enter (Finish Pen), Delete (Delete Point)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spacePressed) {
        setSpacePressed(true);
      }
      if (e.key === 'Escape' || e.key === 'Enter') {
        onFinishPath();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spacePressed, onFinishPath]);

  // Center canvas on first load
  useEffect(() => {
    if (containerRef.current) {
      setPan({ x: 0, y: 0 });
    }
  }, []);

  // Track the viewport box. Resizing the window or collapsing a panel moves
  // the canvas centre, and with it every ruler tick.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      setViewport({ width: r.width, height: r.height });
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom, anchored so the canvas point under the pointer stays under it.
  // Registered natively because React routes wheel through a passive listener,
  // where preventDefault() is ignored and the page scrolls instead.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const next = Math.min(3, Math.max(0.2, zoom * Math.exp(-e.deltaY * 0.0015)));
      if (next === zoom) return;

      const ax = e.clientX - rect.left - rect.width / 2;
      const ay = e.clientY - rect.top - rect.height / 2;
      const k = next / zoom;
      setPan((p) => ({ x: ax - k * (ax - p.x), y: ay - k * (ay - p.y) }));
      onZoomChange(next);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, onZoomChange]);

  // Fit the artboard to the viewport when the toolbar asks for it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || fitSignal === 0) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const fit = Math.min(
      (rect.width - 80) / dimensions.width,
      (rect.height - 80) / dimensions.height
    );
    setPan({ x: 0, y: 0 });
    onZoomChange(Math.min(3, Math.max(0.05, fit)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  // Pressing a ruler drops a guide and immediately starts dragging it, so the
  // pull-out gesture is one continuous motion.
  const startGuideFromRuler = (axis: GuideAxis, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const pos = clientToCanvas(e.clientX, e.clientY);
    const guide = createGuide(axis, axis === 'x' ? pos.x : pos.y);
    onAddGuide(guide);
    onSelectGuide(guide.id, false);
    setGuideDrag({ id: guide.id, axis });
  };

  // Handle Mouse Down on Canvas Workspace
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or Space+click initiates Pan
    if (e.button === 1 || spacePressed || currentTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return; // only left click

    const canvasPos = clientToCanvas(e.clientX, e.clientY);

    // If Pen tool is active
    if (currentTool === 'pen') {
      if (!activeShape) {
        // Start a brand new pen shape
        const newPointId = `pt_${Date.now()}_0`;
        const newPoint: PathPoint = {
          id: newPointId,
          x: Math.round(canvasPos.x),
          y: Math.round(canvasPos.y),
          type: 'straight',
        };

        const newShapeId = `shape_${Date.now()}`;
        const newShape: VectorShape = {
          id: newShapeId,
          name: 'Pen Vector Frame',
          points: [newPoint],
          closed: false,
          fillColor: '#6366f1',
          strokeColor: '#4338ca',
          strokeWidth: 0,
          opacity: 1,
          visible: true,
          locked: false,
          isFrameCandidate: true,
        };

        onUpdateShapes([...shapes, newShape]);
        onSelectShape(newShapeId, false);
        onSelectPoint(newPointId, false);

        // Initiate dragging handles for initial curve
        setDragTarget({
          type: 'handle2',
          shapeId: newShapeId,
          pointId: newPointId,
          handleType: 'cp2',
          startX: canvasPos.x,
          startY: canvasPos.y,
          initialShapes: [...shapes, newShape],
        });
      } else {
        // Active shape exists in pen mode
        const pts = [...activeShape.points];
        // Check if clicking near the first point to close path
        if (pts.length >= 3) {
          const first = pts[0];
          const distToFirst = Math.hypot(canvasPos.x - first.x, canvasPos.y - first.y);
          if (distToFirst <= 12 / zoom) {
            // Close path!
            onUpdateActivePoints(pts, true);
            onFinishPath();
            return;
          }
        }

        // Add new point to active pen path
        const newPointId = `pt_${Date.now()}_${pts.length}`;
        const newPoint: PathPoint = {
          id: newPointId,
          x: Math.round(canvasPos.x),
          y: Math.round(canvasPos.y),
          type: 'straight',
        };

        const updatedPoints = [...pts, newPoint];
        onUpdateActivePoints(updatedPoints, false);
        onSelectPoint(newPointId, false);

        // Drag handle out immediately if mouse dragged
        setDragTarget({
          type: 'handle2',
          shapeId: activeShape.id,
          pointId: newPointId,
          handleType: 'cp2',
          startX: canvasPos.x,
          startY: canvasPos.y,
          initialShapes: shapes,
        });
      }
      return;
    }

    // Clicking empty canvas in Select / DirectSelect mode clears selection
    if (!e.defaultPrevented) {
      onClearSelection();
    }
  };

  // Handle Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvasPos = clientToCanvas(e.clientX, e.clientY);
    setMouseCanvasPos(canvasPos);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (guideDrag) {
      onUpdateGuide(
        guideDrag.id,
        Math.round(guideDrag.axis === 'x' ? canvasPos.x : canvasPos.y)
      );
      return;
    }

    if (!dragTarget) return;

    // The drag has actually moved something, so the state it started from is
    // worth an undo step. Recorded once, on the first move of the drag.
    if (!transformRecorded.current) {
      transformRecorded.current = true;
      onBeginTransform();
    }

    const dx = canvasPos.x - dragTarget.startX;
    const dy = canvasPos.y - dragTarget.startY;

    // 0. Rotating the selection about the pivot fixed at mouse down
    if (dragTarget.type === 'rotate' && dragTarget.center) {
      const raw =
        pointerAngle(dragTarget.center, canvasPos) - (dragTarget.startAngle ?? 0);
      const delta = normalizeAngle(e.shiftKey ? snapAngle(raw) : raw);

      setRotatePreview(delta);
      onUpdateShapes(
        rotateShapes(
          dragTarget.initialShapes,
          selectedShapeIds,
          delta,
          dragTarget.center
        )
      );
      return;
    }

    // 1. Dragging an entire Shape (Move)
    if (dragTarget.type === 'shape') {
      const moving = dragTarget.initialShapes.filter((s) =>
        selectedShapeIds.includes(s.id)
      );

      // Pull the moved box onto any guide it comes close to. The threshold is
      // in screen pixels, so the pull feels the same at every zoom level.
      let moveX = dx;
      let moveY = dy;
      const b = snapToGuides && showGuides ? unionBounds(moving) : null;

      if (b) {
        const snap = snapBoundsToGuides(
          {
            minX: b.minX + dx,
            minY: b.minY + dy,
            maxX: b.maxX + dx,
            maxY: b.maxY + dy,
          },
          guides,
          SNAP_PX / zoom
        );
        moveX += snap.dx;
        moveY += snap.dy;
        if (snap.guideX !== snapHit.x || snap.guideY !== snapHit.y) {
          setSnapHit({ x: snap.guideX, y: snap.guideY });
        }
      } else if (snapHit.x !== null || snapHit.y !== null) {
        setSnapHit({ x: null, y: null });
      }

      const updated = dragTarget.initialShapes.map((s) => {
        if (!selectedShapeIds.includes(s.id)) return s;
        return {
          ...s,
          points: s.points.map((p) => ({
            ...p,
            x: p.x + moveX,
            y: p.y + moveY,
            cp1: p.cp1 ? { x: p.cp1.x + moveX, y: p.cp1.y + moveY } : undefined,
            cp2: p.cp2 ? { x: p.cp2.x + moveX, y: p.cp2.y + moveY } : undefined,
          })),
          subPaths: s.subPaths?.map((sub) =>
            sub.map((p) => ({
              ...p,
              x: p.x + moveX,
              y: p.y + moveY,
              cp1: p.cp1 ? { x: p.cp1.x + moveX, y: p.cp1.y + moveY } : undefined,
              cp2: p.cp2 ? { x: p.cp2.x + moveX, y: p.cp2.y + moveY } : undefined,
            }))
          ),
        };
      });
      onUpdateShapes(updated);
      return;
    }

    // 2. Dragging Anchor Point (Point Move)
    if (dragTarget.type === 'point' && activeShape && dragTarget.pointId) {
      const pts = activeShape.points.map((p) => {
        if (p.id !== dragTarget.pointId) return p;
        const ptDx = canvasPos.x - p.x;
        const ptDy = canvasPos.y - p.y;
        return {
          ...p,
          x: canvasPos.x,
          y: canvasPos.y,
          cp1: p.cp1 ? { x: p.cp1.x + ptDx, y: p.cp1.y + ptDy } : undefined,
          cp2: p.cp2 ? { x: p.cp2.x + ptDx, y: p.cp2.y + ptDy } : undefined,
        };
      });
      onUpdateActivePoints(pts);
      return;
    }

    // 3. Dragging Bézier Control Handle (Handle Move / Curve Adjust / Break Handles)
    if (
      (dragTarget.type === 'handle1' || dragTarget.type === 'handle2') &&
      activeShape &&
      dragTarget.pointId
    ) {
      const isAltPressed = e.altKey;

      const pts = activeShape.points.map((p) => {
        if (p.id !== dragTarget.pointId) return p;

        const updated = { ...p };
        const isCp2 = dragTarget.handleType === 'cp2';

        if (isCp2) {
          updated.cp2 = { x: canvasPos.x, y: canvasPos.y };
          // If point is rounded and NOT broken / alt-dragged, mirror opposite handle
          if (updated.type === 'rounded' && !isAltPressed) {
            const hx = canvasPos.x - updated.x;
            const hy = canvasPos.y - updated.y;
            updated.cp1 = { x: updated.x - hx, y: updated.y - hy };
          } else if (isAltPressed) {
            // Holding alt automatically breaks handle for independent angle manipulation!
            updated.type = 'break';
          }
        } else {
          updated.cp1 = { x: canvasPos.x, y: canvasPos.y };
          if (updated.type === 'rounded' && !isAltPressed) {
            const hx = canvasPos.x - updated.x;
            const hy = canvasPos.y - updated.y;
            updated.cp2 = { x: updated.x - hx, y: updated.y - hy };
          } else if (isAltPressed) {
            updated.type = 'break';
          }
        }

        return updated;
      });

      onUpdateActivePoints(pts);
      return;
    }

    // 4. Resizing Shape via Bounding Box Handle
    if (
      dragTarget.type === 'resize' &&
      dragTarget.initialBounds &&
      activeShape &&
      dragTarget.initialPoints
    ) {
      const b = dragTarget.initialBounds;

      const dir = dragTarget.resizeDir || 'se';
      const {
        minX: newMinX,
        minY: newMinY,
        maxX: newMaxX,
        maxY: newMaxY,
        scaleX,
        scaleY,
      } = resizeBounds(b, dir, dx, dy, e.shiftKey);

      // A rectangle's corners keep their radius instead of being scaled with
      // the box, so stretching one gives a longer rectangle rather than an
      // oval. Other shapes — circles included — scale freely.
      if (activeShape.cornerRadiusPct !== undefined) {
        onUpdateActivePoints(
          buildRectPoints(
            activeShape.id,
            newMinX,
            newMinY,
            newMaxX,
            newMaxY,
            cornerRadiusPx(
              activeShape.cornerRadiusPct,
              newMaxX - newMinX,
              newMaxY - newMinY
            )
          )
        );
        return;
      }

      const resizedPoints = dragTarget.initialPoints.map((p) => ({
        ...p,
        x: newMinX + (p.x - b.minX) * scaleX,
        y: newMinY + (p.y - b.minY) * scaleY,
        cp1: p.cp1
          ? {
              x: newMinX + (p.cp1.x - b.minX) * scaleX,
              y: newMinY + (p.cp1.y - b.minY) * scaleY,
            }
          : undefined,
        cp2: p.cp2
          ? {
              x: newMinX + (p.cp2.x - b.minX) * scaleX,
              y: newMinY + (p.cp2.y - b.minY) * scaleY,
            }
          : undefined,
      }));

      onUpdateActivePoints(resizedPoints);
    }
  };

  // Every drag ends on the window rather than on the canvas, so releasing the
  // button off the edge of the workspace does not leave a guide — or a shape —
  // stuck to the cursor.
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Dropping a guide back on its own ruler, or off the viewport entirely,
      // removes it. That is also what makes a bare click on a ruler harmless.
      if (guideDrag && containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;
        const discarded =
          sx < 0 ||
          sy < 0 ||
          sx > r.width ||
          sy > r.height ||
          (showRulers &&
            (guideDrag.axis === 'x' ? sx < RULER_SIZE : sy < RULER_SIZE));

        if (discarded) onDeleteGuide(guideDrag.id);
      }

      setGuideDrag(null);
      setIsPanning(false);
      setDragTarget(null);
      setSnapHit({ x: null, y: null });
      setRotatePreview(null);
      transformRecorded.current = false;
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [guideDrag, showRulers, onDeleteGuide]);

  // Check if hovering near the first point to show closure indicator in pen mode
  const isNearFirstPoint = (() => {
    if (currentTool !== 'pen' || !activeShape || activeShape.points.length < 3)
      return false;
    const first = activeShape.points[0];
    return (
      Math.hypot(mouseCanvasPos.x - first.x, mouseCanvasPos.y - first.y) <=
      14 / zoom
    );
  })();

  const activeBounds =
    activeShape && currentTool === 'select' ? getShapeBounds(activeShape) : null;

  // Rotation turns the whole selection, so its handle hangs off the box that
  // encloses every selected shape rather than the active one alone. With a
  // single shape selected the two boxes are identical. Locked shapes cannot be
  // rotated, so a selection made only of them gets no handle.
  const rotatable =
    currentTool === 'select'
      ? shapes.filter((s) => selectedShapeIds.includes(s.id) && !s.locked)
      : [];
  const liveRotateBox = rotatable.length > 0 ? unionBounds(rotatable) : null;
  const liveRotateCenter: Point2D | null = liveRotateBox
    ? {
        x: (liveRotateBox.minX + liveRotateBox.maxX) / 2,
        y: (liveRotateBox.minY + liveRotateBox.maxY) / 2,
      }
    : null;

  // Mid-rotation the chrome is drawn from the box and pivot the drag started
  // with. An axis-aligned box grows and shrinks as the shape inside it turns,
  // so following it live would have the handle and the pivot marker crawling
  // around under a pointer that is only sweeping an arc.
  const rotating = dragTarget?.type === 'rotate' ? dragTarget : null;
  const rotateBox = rotating?.initialBounds ?? liveRotateBox;
  const rotateCenter = rotating?.center ?? liveRotateCenter;

  /** How far above the box the rotate handle floats, in screen pixels. */
  const ROTATE_HANDLE_GAP = 22;

  // Canvas coordinate sitting at viewport pixel 0, and the span the viewport
  // covers. Guides are drawn inside the artboard's SVG so they share its
  // transform exactly, which means they need canvas-space endpoints wide
  // enough to run right across the visible area.
  const originX = dimensions.width / 2 - (viewport.width / 2 + pan.x) / zoom;
  const originY = dimensions.height / 2 - (viewport.height / 2 + pan.y) / zoom;
  const spanX = viewport.width / zoom;
  const spanY = viewport.height / zoom;

  // The drawing SVG is stretched to cover the artboard *and* the visible area.
  // An SVG root only hit-tests within its own box, so a guide running off the
  // artboard would paint (overflow is visible) but refuse to be grabbed. The
  // viewBox is offset by the same amount as the box, so every coordinate
  // inside still means exactly what it did before.
  const vbMinX = Math.min(0, originX);
  const vbMinY = Math.min(0, originY);
  const vbWidth = Math.max(dimensions.width, originX + spanX) - vbMinX;
  const vbHeight = Math.max(dimensions.height, originY + spanY) - vbMinY;

  // Guides only take clicks under the Select tool: elsewhere they would eat
  // pen clicks and anchor grabs that happen to land near a line.
  const guidesInteractive = showGuides && currentTool === 'select';

  /** Distance in from the viewport edge that clears the ruler band. */
  const guideLabelInset = (showRulers ? RULER_SIZE + 5 : 5) / zoom;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      className={`flex-1 relative overflow-hidden select-none transition-colors ${
        isDark ? 'bg-[#121212]' : 'bg-[#F3F4F6]'
      } ${
        dragTarget?.type === 'resize'
          ? RESIZE_CURSORS[dragTarget.resizeDir || 'se']
          : dragTarget?.type === 'rotate'
          ? 'cursor-grabbing'
          : spacePressed || currentTool === 'pan'
          ? 'cursor-grab active:cursor-grabbing'
          : currentTool === 'pen'
          ? 'cursor-crosshair'
          : 'cursor-default'
      }`}
    >
      {/* Background Dots Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: isDark
            ? 'radial-gradient(circle, #2A2A2A 1.2px, transparent 1.2px)'
            : 'radial-gradient(circle, #D1D5DB 1.2px, transparent 1.2px)',
          backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Centered Canvas Artboard Container */}
      <div
        className="absolute transition-transform duration-75 origin-center pointer-events-none"
        style={{
          left: '50%',
          top: '50%',
          width: dimensions.width,
          height: dimensions.height,
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
        }}
      >
        {/* Blank Canvas Watermark / Hint when no shapes */}
        {shapes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none p-6 text-center">
            {/* Counter-scale so the hint stays legible at any zoom level */}
            <div
              className="flex flex-col items-center"
              style={{ transform: `scale(${1 / zoom})` }}
            >
              <div className="text-xl font-semibold tracking-tight mb-2 text-gray-500">
                Blank Canva Frame Canvas
              </div>
              <div className="text-sm leading-relaxed max-w-sm text-gray-500">
                Select the Pen Tool (E) or choose a Preset Shape from the toolbar to start
                creating your frame
              </div>
              <div className="text-sm leading-relaxed max-w-sm mt-3 font-mono text-gray-400">
                — or drag &amp; drop an image onto the canvas (SVG, PNG, JPG, WEBP)
              </div>
            </div>
          </div>
        )}

        {/* SVG Drawing Canvas */}
        <svg
          viewBox={`${vbMinX} ${vbMinY} ${vbWidth} ${vbHeight}`}
          className="absolute overflow-visible pointer-events-auto"
          style={{
            left: vbMinX,
            top: vbMinY,
            width: vbWidth,
            height: vbHeight,
          }}
        >
          {/* Render Vector Shapes */}
          {shapes.map((shape) => {
            if (!shape.visible) return null;

            return (
              <path
                key={shape.id}
                d={shapeToSvgPath(shape)}
                fill={shape.fillColor || '#F43F5E'}
                stroke={shape.strokeColor || '#1A1A1A'}
                strokeWidth={shape.strokeWidth}
                fillRule="evenodd"
                opacity={shape.opacity}
                className={`transition-all ${
                  shape.locked
                    ? 'pointer-events-none'
                    : 'cursor-pointer hover:opacity-95'
                }`}
                onMouseDown={(e) => {
                  if (currentTool === 'select' || currentTool === 'directSelect') {
                    e.stopPropagation();
                    onSelectShape(shape.id, e.shiftKey);
                    if (currentTool === 'select') {
                      setDragTarget({
                        type: 'shape',
                        shapeId: shape.id,
                        startX: mouseCanvasPos.x,
                        startY: mouseCanvasPos.y,
                        initialShapes: shapes,
                      });
                    }
                  }
                }}
              />
            );
          })}

          {/* Selection outline. Drawn separately, at a constant on-screen width,
              so it reads as chrome and a stroke-less shape still shows none. */}
          {shapes.map((shape) =>
            shape.visible && selectedShapeIds.includes(shape.id) ? (
              <path
                key={`${shape.id}_sel`}
                d={shapeToSvgPath(shape)}
                fill="none"
                stroke="#F43F5E"
                strokeWidth={1.5 / zoom}
                fillRule="evenodd"
                className="pointer-events-none"
              />
            ) : null
          )}

          {/* Guides. Drawn above the shapes but below the anchor layer, and
              stroked in screen-constant widths like the rest of the chrome. */}
          {showGuides &&
            guides.map((guide) => {
              const isX = guide.axis === 'x';
              const picked = selectedGuideIds.includes(guide.id);
              const snapped = isX
                ? snapHit.x === guide.position
                : snapHit.y === guide.position;
              const dragging = guideDrag?.id === guide.id;

              const x1 = isX ? guide.position : originX;
              const x2 = isX ? guide.position : originX + spanX;
              const y1 = isX ? originY : guide.position;
              const y2 = isX ? originY + spanY : guide.position;

              return (
                <g key={guide.id}>
                  {/* Invisible grab band, comfortably wider than the line */}
                  {guidesInteractive && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="transparent"
                      strokeWidth={8 / zoom}
                      className={isX ? 'cursor-ew-resize' : 'cursor-ns-resize'}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onSelectGuide(guide.id, e.shiftKey);
                        setGuideDrag({ id: guide.id, axis: guide.axis });
                      }}
                    />
                  )}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={
                      picked || snapped || dragging
                        ? GUIDE_ACTIVE_COLOR
                        : GUIDE_COLOR
                    }
                    strokeWidth={(picked || snapped || dragging ? 1.5 : 1) / zoom}
                    className="pointer-events-none"
                  />
                  {(dragging || picked) && (
                    <text
                      // Held clear of the ruler bands, which paint over the
                      // canvas and would otherwise cut the label in half.
                      x={
                        isX
                          ? guide.position + 5 / zoom
                          : originX + guideLabelInset
                      }
                      y={
                        isX
                          ? originY + guideLabelInset + 9 / zoom
                          : guide.position - 5 / zoom
                      }
                      fill={GUIDE_ACTIVE_COLOR}
                      fontSize={10 / zoom}
                      fontFamily="'JetBrains Mono', monospace"
                      className="pointer-events-none"
                    >
                      {isX ? 'X' : 'Y'} {Math.round(guide.position)}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Pen Live Preview Line to Cursor */}
          {currentTool === 'pen' && activeShape && activeShape.points.length > 0 && (
            <line
              x1={activeShape.points[activeShape.points.length - 1].x}
              y1={activeShape.points[activeShape.points.length - 1].y}
              x2={mouseCanvasPos.x}
              y2={mouseCanvasPos.y}
              stroke="#6366f1"
              strokeWidth={2 / zoom}
              strokeDasharray="4,4"
              className="pointer-events-none"
            />
          )}

          {/* Direct Selection / Pen Anchor Points & Handles Layer */}
          {activeShape &&
            (currentTool === 'directSelect' || currentTool === 'pen') && (
              <g className="sub-select-layer">
                {activeShape.points.map((pt, idx) => {
                  const isPointSelected = selectedPointIds.includes(pt.id);
                  const isFirst = idx === 0;

                  return (
                    <g key={pt.id}>
                      {/* Handle 1 (In) */}
                      {pt.cp1 && (
                         <g>
                           <line
                             x1={pt.x}
                             y1={pt.y}
                             x2={pt.cp1.x}
                             y2={pt.cp1.y}
                             stroke="#FF5722"
                             strokeWidth={1.5 / zoom}
                             strokeDasharray="2,2"
                           />
                           <circle
                             cx={pt.cp1.x}
                             cy={pt.cp1.y}
                             r={2.75 / zoom}
                             fill="#FF5722"
                             stroke="#121212"
                             strokeWidth={1 / zoom}
                             className="cursor-move hover:scale-125 transition-transform"
                             style={HOVER_GROW_ORIGIN}
                             onMouseDown={(e) => {
                               e.stopPropagation();
                               setDragTarget({
                                 type: 'handle1',
                                 shapeId: activeShape.id,
                                 pointId: pt.id,
                                 handleType: 'cp1',
                                 startX: mouseCanvasPos.x,
                                 startY: mouseCanvasPos.y,
                                 initialShapes: shapes,
                               });
                             }}
                           />
                         </g>
                       )}

                       {/* Handle 2 (Out) */}
                       {pt.cp2 && (
                         <g>
                           <line
                             x1={pt.x}
                             y1={pt.y}
                             x2={pt.cp2.x}
                             y2={pt.cp2.y}
                             stroke="#FF5722"
                             strokeWidth={1.5 / zoom}
                             strokeDasharray="2,2"
                           />
                           <circle
                             cx={pt.cp2.x}
                             cy={pt.cp2.y}
                             r={2.75 / zoom}
                             fill="#FF5722"
                             stroke="#121212"
                             strokeWidth={1 / zoom}
                             className="cursor-move hover:scale-125 transition-transform"
                             style={HOVER_GROW_ORIGIN}
                             onMouseDown={(e) => {
                               e.stopPropagation();
                               setDragTarget({
                                 type: 'handle2',
                                 shapeId: activeShape.id,
                                 pointId: pt.id,
                                 handleType: 'cp2',
                                 startX: mouseCanvasPos.x,
                                 startY: mouseCanvasPos.y,
                                 initialShapes: shapes,
                               });
                             }}
                           />
                         </g>
                       )}

                       {/* Anchor Dot. Kept small to match the trace preview; the
                           transparent circle behind it holds the click target at
                           a comfortable size so the dot can shrink freely. */}
                       <g
                         className="group cursor-pointer"
                         onMouseDown={(e) => {
                           e.stopPropagation();
                           onSelectPoint(pt.id, e.shiftKey);
                           setDragTarget({
                             type: 'point',
                             shapeId: activeShape.id,
                             pointId: pt.id,
                             startX: mouseCanvasPos.x,
                             startY: mouseCanvasPos.y,
                             initialShapes: shapes,
                           });
                         }}
                       >
                         <circle cx={pt.x} cy={pt.y} r={9 / zoom} fill="transparent" />
                         <circle
                           cx={pt.x}
                           cy={pt.y}
                           r={(isPointSelected ? 3.25 : 2.5) / zoom}
                           fill={isPointSelected ? '#F43F5E' : '#ffffff'}
                           stroke={isFirst && isNearFirstPoint ? '#FF5722' : '#F43F5E'}
                           strokeWidth={(isPointSelected ? 1.5 : 1.25) / zoom}
                           className="pointer-events-none group-hover:scale-125 transition-transform"
                           style={HOVER_GROW_ORIGIN}
                         />
                       </g>
                     </g>
                   );
                 })}
               </g>
             )}

          {/* Select Mode Bounding Box & 8 Resize Handles. Hidden mid-rotation:
              the box is axis-aligned, so it would swell and shrink around a
              shape that is only turning, and its handles resize the wrong
              thing while the pointer is sweeping an arc. */}
          {activeBounds && currentTool === 'select' && !rotating && (
            <g className="bounding-box-layer pointer-events-none">
              <rect
                x={activeBounds.minX}
                y={activeBounds.minY}
                width={activeBounds.width}
                height={activeBounds.height}
                fill="none"
                stroke="#F43F5E"
                strokeWidth={1.5 / zoom}
                strokeDasharray="4,4"
              />

              {/* Handles: nw, ne, se, sw, n, s, e, w */}
              {[
                { dir: 'nw', x: activeBounds.minX, y: activeBounds.minY },
                { dir: 'ne', x: activeBounds.maxX, y: activeBounds.minY },
                { dir: 'se', x: activeBounds.maxX, y: activeBounds.maxY },
                { dir: 'sw', x: activeBounds.minX, y: activeBounds.maxY },
                {
                  dir: 'n',
                  x: (activeBounds.minX + activeBounds.maxX) / 2,
                  y: activeBounds.minY,
                },
                {
                  dir: 's',
                  x: (activeBounds.minX + activeBounds.maxX) / 2,
                  y: activeBounds.maxY,
                },
                {
                  dir: 'w',
                  x: activeBounds.minX,
                  y: (activeBounds.minY + activeBounds.maxY) / 2,
                },
                {
                  dir: 'e',
                  x: activeBounds.maxX,
                  y: (activeBounds.minY + activeBounds.maxY) / 2,
                },
              ].map((h) => (
                <rect
                  key={h.dir}
                  x={h.x - 4 / zoom}
                  y={h.y - 4 / zoom}
                  width={8 / zoom}
                  height={8 / zoom}
                  fill="#ffffff"
                  stroke="#F43F5E"
                  strokeWidth={1.5 / zoom}
                  className={`pointer-events-auto ${RESIZE_CURSORS[h.dir] || 'cursor-nwse-resize'}`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragTarget({
                      type: 'resize',
                      shapeId: activeShape!.id,
                      resizeDir: h.dir as any,
                      startX: mouseCanvasPos.x,
                      startY: mouseCanvasPos.y,
                      initialShapes: shapes,
                      initialPoints: activeShape!.points,
                      initialBounds: activeBounds,
                    });
                  }}
                />
              ))}
            </g>
          )}

          {/* Rotate handle, on the box enclosing the whole selection */}
          {rotateBox && rotateCenter && currentTool === 'select' && (
            <g className="rotate-layer pointer-events-none">
              {/* With several shapes picked the resize box above covers only the
                  active one, so the selection's own box is drawn faintly to
                  show what the handle will turn. */}
              {(rotatable.length > 1 || rotating) && (
                <rect
                  x={rotateBox.minX}
                  y={rotateBox.minY}
                  width={rotateBox.maxX - rotateBox.minX}
                  height={rotateBox.maxY - rotateBox.minY}
                  fill="none"
                  stroke="#F43F5E"
                  strokeOpacity={0.45}
                  strokeWidth={1 / zoom}
                  strokeDasharray="2,4"
                />
              )}

              <line
                x1={rotateCenter.x}
                y1={rotateBox.minY}
                x2={rotateCenter.x}
                y2={rotateBox.minY - ROTATE_HANDLE_GAP / zoom}
                stroke="#F43F5E"
                strokeWidth={1.5 / zoom}
              />

              {/* The pivot, shown only while turning so the still box stays clean */}
              {rotating && (
                <>
                  <circle
                    cx={rotateCenter.x}
                    cy={rotateCenter.y}
                    r={3.5 / zoom}
                    fill="none"
                    stroke="#F43F5E"
                    strokeWidth={1.5 / zoom}
                  />
                  <text
                    x={rotateCenter.x + 8 / zoom}
                    y={rotateBox.minY - (ROTATE_HANDLE_GAP + 6) / zoom}
                    fill="#F43F5E"
                    fontSize={10 / zoom}
                    fontFamily="'JetBrains Mono', monospace"
                  >
                    {(rotatePreview ?? 0) > 0 ? '+' : ''}
                    {Math.round(rotatePreview ?? 0)}°
                  </text>
                </>
              )}

              <g
                className="pointer-events-auto cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => {
                  if (!liveRotateBox || !liveRotateCenter) return;
                  e.stopPropagation();
                  setRotatePreview(0);
                  setDragTarget({
                    type: 'rotate',
                    shapeId: rotatable[0].id,
                    startX: mouseCanvasPos.x,
                    startY: mouseCanvasPos.y,
                    initialShapes: shapes,
                    initialBounds: {
                      ...liveRotateBox,
                      width: liveRotateBox.maxX - liveRotateBox.minX,
                      height: liveRotateBox.maxY - liveRotateBox.minY,
                    },
                    center: liveRotateCenter,
                    startAngle: pointerAngle(liveRotateCenter, mouseCanvasPos),
                  });
                }}
              >
                {/* Transparent disc holding the grab target at a comfortable
                    size, so the visible dot can stay small. */}
                <circle
                  cx={rotateCenter.x}
                  cy={rotateBox.minY - ROTATE_HANDLE_GAP / zoom}
                  r={10 / zoom}
                  fill="transparent"
                />
                <circle
                  cx={rotateCenter.x}
                  cy={rotateBox.minY - ROTATE_HANDLE_GAP / zoom}
                  r={4.5 / zoom}
                  fill="#ffffff"
                  stroke="#F43F5E"
                  strokeWidth={1.5 / zoom}
                  className="pointer-events-none"
                />
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* Rulers along the top and left edges, and the source of new guides */}
      {showRulers && viewport.width > 0 && (
        <Rulers
          width={viewport.width}
          height={viewport.height}
          zoom={zoom}
          originX={originX}
          originY={originY}
          mouse={mouseCanvasPos}
          onStartGuideDrag={startGuideFromRuler}
        />
      )}

      {/* Floating Canvas Meta Pill */}
      <div
        style={{ left: showRulers ? RULER_SIZE + 12 : 12 }}
        className={`absolute bottom-3 z-20 flex items-center gap-2 backdrop-blur-md px-3 py-1 rounded border text-[10px] font-mono transition-colors shadow-lg ${
        isDark
          ? 'bg-[#1A1A1A]/95 border-[#2A2A2A] text-neutral-400'
          : 'bg-white/95 border-gray-200 text-gray-600'
      }`}>
        <span>
          X: {Math.round(mouseCanvasPos.x)} Y: {Math.round(mouseCanvasPos.y)}
        </span>
        <span className={isDark ? 'text-[#444]' : 'text-gray-300'}>•</span>
        <span>
          {dimensions.width} × {dimensions.height} px
        </span>
        {currentTool === 'pen' && (
          <>
            <span className={isDark ? 'text-[#444]' : 'text-gray-300'}>•</span>
            <span className="text-[#F43F5E] font-medium">Pen: Click to add point, drag for curve</span>
          </>
        )}
      </div>
    </div>
  );
};
