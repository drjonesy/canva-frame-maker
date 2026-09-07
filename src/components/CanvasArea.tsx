import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { scaleShapes } from '../utils/scale';
import { createGuide, snapBoundsToGuides, unionBounds } from '../utils/guides';
import {
  getShapeBounds,
  pointsToSvgPath,
  shapeToSvgPath,
} from '../utils/bezier';
import { insertPointOnPath, projectOntoPath } from '../utils/addPoint';
import { translateShape } from '../utils/alignment';
import { fontStack } from '../utils/googleFonts';
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
  /** Lock Move (L): hold a Select-tool drag to a single axis. */
  lockMove: boolean;
  onAddGuide: (guide: Guide) => void;
  onUpdateGuide: (id: string, position: number) => void;
  onDeleteGuide: (id: string) => void;
  onSelectGuide: (id: string, multi: boolean) => void;
  onSelectShape: (id: string, multi: boolean) => void;
  /**
   * A marquee drag has finished and caught `ids`. `additive` is the Shift key:
   * true adds them to the standing selection, false replaces it — including
   * with nothing, since a box drawn over empty canvas deselects.
   */
  onMarqueeSelect: (ids: string[], additive: boolean) => void;
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
  /** The Text tool was clicked on empty canvas: start a text layer here. */
  onPlaceText: (position: Point2D) => void;
  /** The text layer being typed into, or null when nothing is being typed. */
  editingTextId: string | null;
  /** Enter or leave typing on a text layer. */
  onEditText: (shapeId: string | null) => void;
  /** A keystroke in the on-canvas editor. */
  onTextContentChange: (content: string) => void;
  /**
   * The edited face's vertical metrics, as fractions of the em, so the caret
   * in the invisible editor lands on the same baseline as the outlines under
   * it. Null until the face has loaded, where a nominal pair is used instead.
   */
  editingTextMetrics: { ascentEm: number; descentEm: number } | null;
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

/** Radius, in screen pixels, of an anchor's invisible click target. */
const ANCHOR_HIT_PX = 9;

/**
 * How close, in screen pixels, the pointer has to come to the first anchor for
 * a pen click to close the path. Slightly wider than the anchor's normal
 * target so the closing gesture is the easier one to hit.
 */
const CLOSE_PATH_PX = 12;

/**
 * How close, in screen pixels, the pointer has to come to an outline for the
 * Add Anchor tool to offer a point there. Generous: the target is a line, and
 * a click that misses it does nothing at all.
 */
const ADD_POINT_PX = 14;

/**
 * How far, in screen pixels, a drag from empty canvas has to travel before it
 * counts as a marquee rather than a click. Below it the gesture is read as the
 * plain click it almost certainly was, and clears the selection as before — a
 * hand that twitches two pixels must not silently mean something else.
 */
const MARQUEE_MIN_PX = 3;

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
  lockMove,
  onAddGuide,
  onUpdateGuide,
  onDeleteGuide,
  onSelectGuide,
  onSelectShape,
  onMarqueeSelect,
  onClearSelection,
  onSelectPoint,
  onUpdateShapes,
  onUpdateActivePoints,
  onFinishPath,
  onBeginTransform,
  onPlaceText,
  editingTextId,
  onEditText,
  onTextContentChange,
  editingTextMetrics,
}) => {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const textEditorRef = useRef<HTMLTextAreaElement>(null);
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

  // The marquee box being dragged out of empty canvas, in canvas coordinates.
  // `additive` is the Shift key as it was at mouse down, held for the whole
  // drag so letting go of Shift before the button does not change the outcome.
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    additive: boolean;
  } | null>(null);

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

  // While the pen is drawing, the first anchor doubles as the close button. A
  // path needs three points before it encloses anything, and one already closed
  // has nothing left to join.
  const penClosable =
    currentTool === 'pen' &&
    !!activeShape &&
    !activeShape.closed &&
    activeShape.points.length >= 3;

  // Pointer sitting on that first anchor, ready to close.
  const isNearFirstPoint =
    penClosable &&
    Math.hypot(
      mouseCanvasPos.x - activeShape!.points[0].x,
      mouseCanvasPos.y - activeShape!.points[0].y
    ) <= CLOSE_PATH_PX / zoom;

  // Joining the last anchor back to the first also ends the drawing session:
  // a closed frame is finished, and staying in the pen would only start
  // scattering stray points on top of it.
  const closeActivePath = useCallback(() => {
    if (!activeShape || activeShape.closed || activeShape.points.length < 3) return;
    onBeginTransform();
    onUpdateActivePoints(activeShape.points, true);
    onFinishPath();
  }, [activeShape, onBeginTransform, onUpdateActivePoints, onFinishPath]);

  /**
   * Where the Add Anchor tool would drop a point for a pointer at `pos`, or
   * null if it would drop none — too far from the outline, or close enough to
   * an anchor that the anchor's own hit target is going to take the click and
   * a second point on top of it would be a mistake anyway.
   */
  const addPointTargetAt = useCallback(
    (pos: Point2D) => {
      if (!activeShape || activeShape.points.length < 2) return null;

      const onAnchor = activeShape.points.some(
        (p) => Math.hypot(pos.x - p.x, pos.y - p.y) <= ANCHOR_HIT_PX / zoom
      );
      if (onAnchor) return null;

      const hit = projectOntoPath(activeShape.points, !!activeShape.closed, pos);
      if (!hit || hit.distance > ADD_POINT_PX / zoom) return null;
      return hit;
    },
    [activeShape, zoom]
  );

  // The spot under the pointer right now, for the preview dot. Recomputed on
  // every mouse move, so it is kept to the one tool that draws it.
  const addPointHover = useMemo(
    () => (currentTool === 'addPoint' ? addPointTargetAt(mouseCanvasPos) : null),
    [currentTool, addPointTargetAt, mouseCanvasPos]
  );

  // Split the segment under the pointer, leaving the outline where it is. The
  // projection is taken fresh from the click rather than from the hover state,
  // so a click that lands without a preceding move still hits the right spot.
  const addPointAt = useCallback(
    (pos: Point2D) => {
      if (!activeShape) return;
      const hit = addPointTargetAt(pos);
      if (!hit) return;

      const { points, insertedId } = insertPointOnPath(activeShape.points, hit);
      onBeginTransform();
      onUpdateActivePoints(points);
      onSelectPoint(insertedId, false);
    },
    [activeShape, addPointTargetAt, onBeginTransform, onUpdateActivePoints, onSelectPoint]
  );

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

  // Key handlers for Space (Pan), Enter (Close Pen Path), Escape (Finish Open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Typing a coordinate into the inspector must not end the path.
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space' && !spacePressed) {
        setSpacePressed(true);
      }
      // Enter finishes the shape the way the pen is usually meant to end —
      // joined up — while Escape always leaves the path open.
      if (e.key === 'Enter') {
        if (penClosable) closeActivePath();
        else onFinishPath();
      }
      if (e.key === 'Escape') {
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
  }, [spacePressed, onFinishPath, penClosable, closeActivePath]);

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

    // Text: a click on empty canvas drops a new text layer where it landed
    // and puts the caret in it. A click on an existing text layer is caught by
    // that layer's own handler below, which opens it for typing instead.
    if (currentTool === 'text') {
      onPlaceText(canvasPos);
      return;
    }

    // Add Anchor: only ever splits a segment. A click nowhere near the outline
    // is left alone rather than clearing the selection, since losing the shape
    // you are editing is the one thing that would stop the tool working.
    if (currentTool === 'addPoint') {
      addPointAt(canvasPos);
      return;
    }

    // If Pen tool is active
    if (currentTool === 'pen') {
      // A closed outline has no loose end to carry on from, so the Pen starts
      // a fresh path rather than appending a point that would drag the closing
      // segment across the shape. Adding to a closed path is Add Anchor's job.
      if (!activeShape || activeShape.closed) {
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
        // Clicking the first anchor closes the path. Note that the anchor layer
        // sits above this handler and stops propagation, so most such clicks
        // are caught there instead — this covers the ring just outside it.
        if (isNearFirstPoint) {
          closeActivePath();
          return;
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

    // Pressing empty canvas under Select starts a marquee. Nothing is cleared
    // here: a Shift-drag has to add to the selection it started from, and the
    // bare click that clears is settled on mouse up instead, once it is known
    // that the pointer never went anywhere. Every other tool clears as before.
    if (!e.defaultPrevented) {
      if (currentTool === 'select') {
        setMarquee({
          startX: canvasPos.x,
          startY: canvasPos.y,
          x: canvasPos.x,
          y: canvasPos.y,
          additive: e.shiftKey,
        });
      } else {
        onClearSelection();
      }
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

    if (marquee) {
      setMarquee((m) => (m ? { ...m, x: canvasPos.x, y: canvasPos.y } : m));
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

      // Lock Move holds the drag to a single axis. Which one is decided from
      // the travel so far rather than latched at mouse down, so the lock
      // follows the pointer if the drag turns a corner, and toggling L part
      // way through a drag takes effect on the next move.
      const axisLock: 'x' | 'y' | null = lockMove
        ? Math.abs(dx) >= Math.abs(dy)
          ? 'x'
          : 'y'
        : null;

      // Pull the moved box onto any guide it comes close to. The threshold is
      // in screen pixels, so the pull feels the same at every zoom level.
      let moveX = axisLock === 'y' ? 0 : dx;
      let moveY = axisLock === 'x' ? 0 : dy;
      const b = snapToGuides && showGuides ? unionBounds(moving) : null;

      if (b) {
        const snap = snapBoundsToGuides(
          {
            minX: b.minX + moveX,
            minY: b.minY + moveY,
            maxX: b.maxX + moveX,
            maxY: b.maxY + moveY,
          },
          guides,
          SNAP_PX / zoom
        );
        // A guide on the locked axis is ignored — nudging the shape onto it
        // would break the straight line the lock is there to hold.
        const hitX = axisLock === 'y' ? null : snap.guideX;
        const hitY = axisLock === 'x' ? null : snap.guideY;
        if (hitX !== null) moveX += snap.dx;
        if (hitY !== null) moveY += snap.dy;
        if (hitX !== snapHit.x || hitY !== snapHit.y) {
          setSnapHit({ x: hitX, y: hitY });
        }
      } else if (snapHit.x !== null || snapHit.y !== null) {
        setSnapHit({ x: null, y: null });
      }

      // `translateShape` rather than the offset written out here, so a text
      // layer's typesetting origin moves with its outlines by the one route
      // every other move already takes.
      const updated = dragTarget.initialShapes.map((s) =>
        selectedShapeIds.includes(s.id) ? translateShape(s, moveX, moveY) : s
      );
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

    // 4. Resizing via Bounding Box Handle. The box encloses the whole
    // selection, so the drag scales every selected shape as one block rather
    // than only the active one.
    if (dragTarget.type === 'resize' && dragTarget.initialBounds) {
      const b = dragTarget.initialBounds;
      const dir = dragTarget.resizeDir || 'se';

      onUpdateShapes(
        scaleShapes(
          dragTarget.initialShapes,
          selectedShapeIds,
          b,
          resizeBounds(b, dir, dx, dy, e.shiftKey)
        )
      );
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

      if (marquee) {
        // The threshold is in screen pixels, so the same wrist movement counts
        // as the same gesture whether the canvas is zoomed in or out.
        const spanX = Math.abs(marquee.x - marquee.startX) * zoom;
        const spanY = Math.abs(marquee.y - marquee.startY) * zoom;

        if (spanX < MARQUEE_MIN_PX && spanY < MARQUEE_MIN_PX) {
          // A click, not a drag. Shift-clicking empty canvas is left alone:
          // that gesture is about keeping a selection, not dropping it.
          if (!marquee.additive) onClearSelection();
        } else {
          const box = {
            minX: Math.min(marquee.startX, marquee.x),
            minY: Math.min(marquee.startY, marquee.y),
            maxX: Math.max(marquee.startX, marquee.x),
            maxY: Math.max(marquee.startY, marquee.y),
          };

          // Touched, not enclosed: a box has to swallow a shape whole to catch
          // it under a containment rule, which makes picking one large shape
          // out of a crowd near impossible. Hidden and locked layers are
          // passed over — neither takes a click on the canvas either.
          const caught = shapes
            .filter((s) => s.visible && !s.locked)
            .filter((s) => {
              const b = getShapeBounds(s);
              return (
                b.minX <= box.maxX &&
                b.maxX >= box.minX &&
                b.minY <= box.maxY &&
                b.maxY >= box.minY
              );
            })
            .map((s) => s.id);

          onMarqueeSelect(caught, marquee.additive);
        }
      }

      setMarquee(null);
      setGuideDrag(null);
      setIsPanning(false);
      setDragTarget(null);
      setSnapHit({ x: null, y: null });
      setRotatePreview(null);
      transformRecorded.current = false;
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [
    guideDrag,
    showRulers,
    onDeleteGuide,
    marquee,
    shapes,
    zoom,
    onMarqueeSelect,
    onClearSelection,
  ]);

  // Scaling and rotation both work on the whole selection, so they share one
  // box: the one enclosing every selected shape rather than the active one
  // alone. With a single shape picked the two are identical. Locked shapes are
  // left out — they can be neither turned nor scaled, so a selection made only
  // of them gets no chrome at all.
  const transformable =
    currentTool === 'select'
      ? shapes.filter((s) => selectedShapeIds.includes(s.id) && !s.locked)
      : [];
  const liveSelectionBox = transformable.length > 0 ? unionBounds(transformable) : null;
  const selectionBounds = liveSelectionBox
    ? {
        ...liveSelectionBox,
        width: liveSelectionBox.maxX - liveSelectionBox.minX,
        height: liveSelectionBox.maxY - liveSelectionBox.minY,
      }
    : null;
  const liveRotateCenter: Point2D | null = liveSelectionBox
    ? {
        x: (liveSelectionBox.minX + liveSelectionBox.maxX) / 2,
        y: (liveSelectionBox.minY + liveSelectionBox.maxY) / 2,
      }
    : null;

  // Mid-rotation the chrome is drawn from the box and pivot the drag started
  // with. An axis-aligned box grows and shrinks as the shape inside it turns,
  // so following it live would have the handle and the pivot marker crawling
  // around under a pointer that is only sweeping an arc.
  const rotating = dragTarget?.type === 'rotate' ? dragTarget : null;
  const rotateBox = rotating?.initialBounds ?? selectionBounds;
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

  // Guides take clicks under Select and Sub-Select, but not the Pen, where the
  // grab band would eat clicks meant to drop a point. Anchors are safe either
  // way: the anchor layer is drawn after the guides, so it wins the hit test.
  // Sub-Select is included because picking an edge for Parallel means picking
  // two anchors *and* a guide, and switching to Select to reach the guide would
  // clear the point selection on the way.
  const guidesInteractive =
    showGuides && (currentTool === 'select' || currentTool === 'directSelect');

  /** Distance in from the viewport edge that clears the ruler band. */
  const guideLabelInset = (showRulers ? RULER_SIZE + 5 : 5) / zoom;

  // The two anchors Parallel would read as an edge, drawn as a chord across
  // the shape so "pick an edge" is something you can see rather than infer.
  // It is the straight line between them either way — that is the direction
  // Parallel measures, even where the segment itself curves.
  const pickedEdge =
    activeShape && selectedPointIds.length === 2
      ? (selectedPointIds
          .map((id) => activeShape.points.find((p) => p.id === id))
          .filter(Boolean) as PathPoint[])
      : [];

  /**
   * Where the on-canvas editor sits, in canvas coordinates, and what it is set
   * in.
   *
   * A text layer's `y` is the top of its first line's *ascent*, while a CSS
   * line box starts half the leading above that ascent — so the box has to be
   * lifted by that half-leading for the two baselines to coincide. The real
   * metrics come from the loaded face; the fallback pair is only in use for the
   * instant before it arrives, when there is nothing drawn to be out of step
   * with anyway.
   */
  const textEditor = useMemo(() => {
    const shape = editingTextId
      ? shapes.find((s) => s.id === editingTextId)
      : undefined;
    if (!shape?.text) return null;

    const style = shape.text;
    const ascentEm = editingTextMetrics?.ascentEm ?? 1;
    const descentEm = editingTextMetrics?.descentEm ?? 0.25;
    const halfLeading =
      ((style.lineHeight - (ascentEm + descentEm)) * style.fontSize) / 2;

    const lines = style.content.split('\n');
    const longest = lines.reduce((n, l) => Math.max(n, l.length), 1);

    return {
      style,
      left: style.x,
      top: style.y - halfLeading,
      // Generous on both axes: the box only has to hold the caret, and one
      // that ran out of room would scroll the text away from the outlines.
      width: (longest + 4) * style.fontSize,
      height: (lines.length + 1) * style.fontSize * style.lineHeight,
    };
  }, [editingTextId, shapes, editingTextMetrics]);

  // Opening a layer for typing puts the caret at the end of what is there,
  // which is where a click on a word almost always means to carry on from.
  useEffect(() => {
    if (!editingTextId) return;
    const el = textEditorRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editingTextId]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      className={`flex-1 relative overflow-hidden select-none transition-colors ${
        isDark ? 'bg-[#121212]' : 'bg-[#F3F4F6]'
      } ${
        marquee
          ? 'cursor-crosshair'
          : dragTarget?.type === 'resize'
          ? RESIZE_CURSORS[dragTarget.resizeDir || 'se']
          : dragTarget?.type === 'rotate'
          ? 'cursor-grabbing'
          : spacePressed || currentTool === 'pan'
          ? 'cursor-grab active:cursor-grabbing'
          : currentTool === 'pen'
          ? isNearFirstPoint
            ? 'cursor-pointer'
            : 'cursor-crosshair'
          : currentTool === 'addPoint'
          ? addPointHover
            ? 'cursor-copy'
            : 'cursor-crosshair'
          : currentTool === 'text'
          ? 'cursor-text'
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
                Blank Canvas
              </div>
              <div className="text-sm leading-relaxed max-w-sm text-gray-500">
                Select the Pen Tool (E) or choose a Preset Shape from the toolbar to start
                creating your frame
              </div>
              <div className="text-sm leading-relaxed max-w-sm mt-3 font-mono text-gray-400">
                — or drag &amp; drop onto the canvas: a saved .cf.json project, or
                an image (SVG, PNG, JPG, WEBP)
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
                // Double-click opens a text layer for typing whatever tool is
                // up, the way every editor lets you get back into a word — no
                // hunting for the Text tool first. A layer that is only
                // outlines has nothing to type into, so it is left alone.
                onDoubleClick={(e) => {
                  if (!shape.text) return;
                  e.stopPropagation();
                  onEditText(shape.id);
                }}
                onMouseDown={(e) => {
                  // Text: clicking a text layer edits *that* layer rather
                  // than starting a second one on top of it.
                  if (currentTool === 'text' && shape.text) {
                    e.stopPropagation();
                    onSelectShape(shape.id, false);
                    onEditText(shape.id);
                    return;
                  }

                  // Add Anchor: the fill sits above the canvas handler, so a
                  // click on the shape has to be dealt with here. Picking the
                  // shape comes first — you cannot add a point to an outline
                  // that is not the one being edited.
                  if (currentTool === 'addPoint') {
                    e.stopPropagation();
                    if (shape.id !== activeShape?.id) {
                      onSelectShape(shape.id, false);
                      return;
                    }
                    addPointAt(clientToCanvas(e.clientX, e.clientY));
                    return;
                  }

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

          {/* Pen Live Preview Line to Cursor. Over the first anchor it snaps to
              that anchor and goes solid, so the closing segment is drawn before
              the click rather than only after it. */}
          {currentTool === 'pen' && activeShape && !activeShape.closed && activeShape.points.length > 0 && (
            <line
              x1={activeShape.points[activeShape.points.length - 1].x}
              y1={activeShape.points[activeShape.points.length - 1].y}
              x2={isNearFirstPoint ? activeShape.points[0].x : mouseCanvasPos.x}
              y2={isNearFirstPoint ? activeShape.points[0].y : mouseCanvasPos.y}
              stroke={isNearFirstPoint ? '#FF5722' : '#6366f1'}
              strokeWidth={2 / zoom}
              strokeDasharray={isNearFirstPoint ? undefined : '4,4'}
              className="pointer-events-none"
            />
          )}

          {/* Add Anchor preview: a dot sitting on the outline exactly where a
              click would leave a point. The Pen's dashed rubber band is about
              where the path is going next; this tool adds nothing to the end,
              so the dot is the whole of what it promises. */}
          {currentTool === 'addPoint' && addPointHover && (
            <g className="pointer-events-none">
              <circle
                cx={addPointHover.point.x}
                cy={addPointHover.point.y}
                r={7 / zoom}
                fill="#FF5722"
                fillOpacity={0.18}
              />
              <circle
                cx={addPointHover.point.x}
                cy={addPointHover.point.y}
                r={3.5 / zoom}
                fill="#FF5722"
                stroke="#ffffff"
                strokeWidth={1.25 / zoom}
              />
            </g>
          )}

          {/* Direct Selection / Pen Anchor Points & Handles Layer */}
          {activeShape &&
            (currentTool === 'directSelect' ||
              currentTool === 'pen' ||
              currentTool === 'addPoint') && (
              <g className="sub-select-layer">
                {/* The picked edge, under the anchors so it never blocks one */}
                {pickedEdge.length === 2 && (
                  <line
                    x1={pickedEdge[0].x}
                    y1={pickedEdge[0].y}
                    x2={pickedEdge[1].x}
                    y2={pickedEdge[1].y}
                    stroke="#F43F5E"
                    strokeWidth={2.5 / zoom}
                    strokeOpacity={0.85}
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                )}
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
                           // This layer is drawn above the canvas and swallows
                           // the click, so closing on the first anchor has to
                           // happen here rather than in handleMouseDown.
                           if (isFirst && penClosable) {
                             closeActivePath();
                             return;
                           }
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
                         <circle
                           cx={pt.x}
                           cy={pt.y}
                           r={
                             (isFirst && penClosable ? CLOSE_PATH_PX : ANCHOR_HIT_PX) /
                             zoom
                           }
                           fill="transparent"
                         />
                         {/* Halo marking the anchor that closes the path, so the
                             gesture is visible from across the canvas rather
                             than only once the pointer is already on it. */}
                         {isFirst && penClosable && (
                           <circle
                             cx={pt.x}
                             cy={pt.y}
                             r={(isNearFirstPoint ? 7 : 5.5) / zoom}
                             fill="none"
                             stroke="#FF5722"
                             strokeWidth={1.5 / zoom}
                             strokeOpacity={isNearFirstPoint ? 1 : 0.5}
                             className="pointer-events-none"
                           />
                         )}
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
          {selectionBounds && currentTool === 'select' && !rotating && (
            <g className="bounding-box-layer pointer-events-none">
              <rect
                x={selectionBounds.minX}
                y={selectionBounds.minY}
                width={selectionBounds.width}
                height={selectionBounds.height}
                fill="none"
                stroke="#F43F5E"
                strokeWidth={1.5 / zoom}
                strokeDasharray="4,4"
              />

              {/* Handles: nw, ne, se, sw, n, s, e, w */}
              {[
                { dir: 'nw', x: selectionBounds.minX, y: selectionBounds.minY },
                { dir: 'ne', x: selectionBounds.maxX, y: selectionBounds.minY },
                { dir: 'se', x: selectionBounds.maxX, y: selectionBounds.maxY },
                { dir: 'sw', x: selectionBounds.minX, y: selectionBounds.maxY },
                {
                  dir: 'n',
                  x: (selectionBounds.minX + selectionBounds.maxX) / 2,
                  y: selectionBounds.minY,
                },
                {
                  dir: 's',
                  x: (selectionBounds.minX + selectionBounds.maxX) / 2,
                  y: selectionBounds.maxY,
                },
                {
                  dir: 'w',
                  x: selectionBounds.minX,
                  y: (selectionBounds.minY + selectionBounds.maxY) / 2,
                },
                {
                  dir: 'e',
                  x: selectionBounds.maxX,
                  y: (selectionBounds.minY + selectionBounds.maxY) / 2,
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
                      shapeId: transformable[0].id,
                      resizeDir: h.dir as any,
                      startX: mouseCanvasPos.x,
                      startY: mouseCanvasPos.y,
                      initialShapes: shapes,
                      initialBounds: selectionBounds,
                    });
                  }}
                />
              ))}

              {/* Live width and height of the box, in canvas px, drawn as a
                  dimension line: an end tick at each extent, a rule running
                  between them, and the number sitting in a gap in the middle of
                  that rule. With more than one shape picked this is the union —
                  the outer span across the whole selection — rather than any one
                  shape's own size, which is the only measurement that means
                  anything while they are being scaled or aligned as a group.
                  Grey rather than the selection's rose: it is a readout, not
                  something to grab, and it should not compete with the handles
                  that are. */}
              {(() => {
                /** Screen px → canvas units, so the chrome holds its size. */
                const s = (px: number) => px / zoom;
                const color = isDark ? '#D1D5DB' : '#9CA3AF';
                const FONT = 13;
                /** Half-length of the tick capping each end of the rule. */
                const CAP = 5;
                /** How far the rule floats off the box. */
                const OFFSET = 24;
                /** Clear space between the rule and the number. */
                const PAD = 7;

                const cx = (selectionBounds.minX + selectionBounds.maxX) / 2;
                const cy = (selectionBounds.minY + selectionBounds.maxY) / 2;
                const wLabel = `${Math.round(selectionBounds.width)}`;
                const hLabel = `${Math.round(selectionBounds.height)}`;

                // JetBrains Mono advances 0.6em a glyph, so the gap each label
                // needs can be measured off the string rather than the DOM.
                const wGap = s(wLabel.length * FONT * 0.6 + PAD * 2) / 2;
                const hGap = s(FONT + PAD * 2) / 2;

                const y = selectionBounds.maxY + s(OFFSET);
                const x = selectionBounds.maxX + s(OFFSET);

                // On a box narrower than its own label the rule would run
                // backwards, so the ticks and the number stand alone.
                const wRule = cx - wGap > selectionBounds.minX;
                const hRule = cy - hGap > selectionBounds.minY;

                const line = { stroke: color, strokeWidth: s(1) };
                const label = {
                  fill: color,
                  fontSize: s(FONT),
                  fontFamily: "'JetBrains Mono', monospace",
                  textAnchor: 'middle' as const,
                  dominantBaseline: 'central' as const,
                };

                return (
                  <>
                    {/* Width */}
                    <line
                      x1={selectionBounds.minX}
                      y1={y - s(CAP)}
                      x2={selectionBounds.minX}
                      y2={y + s(CAP)}
                      {...line}
                    />
                    <line
                      x1={selectionBounds.maxX}
                      y1={y - s(CAP)}
                      x2={selectionBounds.maxX}
                      y2={y + s(CAP)}
                      {...line}
                    />
                    {wRule && (
                      <>
                        <line
                          x1={selectionBounds.minX}
                          y1={y}
                          x2={cx - wGap}
                          y2={y}
                          {...line}
                        />
                        <line
                          x1={cx + wGap}
                          y1={y}
                          x2={selectionBounds.maxX}
                          y2={y}
                          {...line}
                        />
                      </>
                    )}
                    <text x={cx} y={y} {...label}>
                      {wLabel}
                    </text>

                    {/* Height */}
                    <line
                      x1={x - s(CAP)}
                      y1={selectionBounds.minY}
                      x2={x + s(CAP)}
                      y2={selectionBounds.minY}
                      {...line}
                    />
                    <line
                      x1={x - s(CAP)}
                      y1={selectionBounds.maxY}
                      x2={x + s(CAP)}
                      y2={selectionBounds.maxY}
                      {...line}
                    />
                    {hRule && (
                      <>
                        <line
                          x1={x}
                          y1={selectionBounds.minY}
                          x2={x}
                          y2={cy - hGap}
                          {...line}
                        />
                        <line
                          x1={x}
                          y1={cy + hGap}
                          x2={x}
                          y2={selectionBounds.maxY}
                          {...line}
                        />
                      </>
                    )}
                    <text x={x} y={cy} {...label}>
                      {hLabel}
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* Rotate handle, on the box enclosing the whole selection */}
          {rotateBox && rotateCenter && currentTool === 'select' && (
            <g className="rotate-layer pointer-events-none">
              {/* Mid-rotation the resize box above is hidden, so the box the
                  turn started from is drawn faintly in its place. */}
              {rotating && (
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
                  if (!selectionBounds || !liveRotateCenter) return;
                  e.stopPropagation();
                  setRotatePreview(0);
                  setDragTarget({
                    type: 'rotate',
                    shapeId: transformable[0].id,
                    startX: mouseCanvasPos.x,
                    startY: mouseCanvasPos.y,
                    initialShapes: shapes,
                    initialBounds: selectionBounds,
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

          {/* The marquee box. Drawn last so it stays on top of every shape and
              every piece of selection chrome it is dragged across, and with a
              faint fill so the area it covers reads as one region rather than
              four lines. */}
          {marquee && (
            <rect
              x={Math.min(marquee.startX, marquee.x)}
              y={Math.min(marquee.startY, marquee.y)}
              width={Math.abs(marquee.x - marquee.startX)}
              height={Math.abs(marquee.y - marquee.startY)}
              fill="#F43F5E"
              fillOpacity={0.08}
              stroke="#F43F5E"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom},${3 / zoom}`}
              className="pointer-events-none"
            />
          )}
        </svg>

        {/* The on-canvas text editor.

            A real <textarea>, laid over the outlines it is typing, with its
            own text left transparent so what is on screen stays the vector
            geometry rather than a DOM copy of it that would drift from it.
            Only the caret and the selection band show through.

            It lives inside the artboard container, so its coordinates are
            canvas coordinates and the container's own transform carries it
            through pan and zoom — no second copy of that maths to keep in
            step. `wrap="off"` because the outlines do not wrap either: a line
            ends where a newline is typed and nowhere else. */}
        {textEditor && (
          <textarea
            ref={textEditorRef}
            value={textEditor.style.content}
            wrap="off"
            spellCheck={false}
            onChange={(e) => onTextContentChange(e.target.value)}
            onBlur={() => onEditText(null)}
            onKeyDown={(e) => {
              // Escape leaves the layer as typed; Enter is a newline, so it
              // must not reach the pen's "finish path" handler.
              if (e.key === 'Escape') {
                e.preventDefault();
                e.currentTarget.blur();
              }
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute pointer-events-auto bg-transparent border-0 p-0 m-0 resize-none overflow-hidden focus:outline-none"
            style={{
              left: textEditor.left,
              top: textEditor.top,
              width: textEditor.width,
              height: textEditor.height,
              fontFamily: fontStack(textEditor.style.fontFamily),
              fontSize: textEditor.style.fontSize,
              fontWeight: textEditor.style.bold ? 700 : 400,
              fontStyle: textEditor.style.italic ? 'italic' : 'normal',
              letterSpacing: textEditor.style.letterSpacing,
              lineHeight: textEditor.style.lineHeight,
              color: 'transparent',
              caretColor: '#F43F5E',
              whiteSpace: 'pre',
            }}
          />
        )}
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
        {currentTool === 'pen' && (
          <>
            <span className={isDark ? 'text-[#444]' : 'text-gray-300'}>•</span>
            <span className="text-[#F43F5E] font-medium">
              {penClosable
                ? 'Pen: Click the first anchor or press Enter to close · Esc leaves it open'
                : activeShape?.closed
                ? 'Pen: This path is closed — click to start a new one, or use Add Anchor (A) to edit it'
                : 'Pen: Click to add point, drag for curve'}
            </span>
          </>
        )}
        {currentTool === 'addPoint' && (
          <>
            <span className={isDark ? 'text-[#444]' : 'text-gray-300'}>•</span>
            <span className="text-[#F43F5E] font-medium">
              {!activeShape
                ? 'Add Anchor: Click a shape to edit its outline'
                : addPointHover
                ? 'Add Anchor: Click to drop a point here'
                : 'Add Anchor: Move onto the outline, then click'}
            </span>
          </>
        )}
        {currentTool === 'text' && (
          <>
            <span className={isDark ? 'text-[#444]' : 'text-gray-300'}>•</span>
            <span className="text-[#F43F5E] font-medium">
              {editingTextId
                ? 'Text: Type away · Esc or a click off it finishes'
                : 'Text: Click to place text, or click a text layer to retype it'}
            </span>
          </>
        )}
        {/* A mode with no other tell on the canvas — a drag that will not go
            diagonally should say why before the drag, not after. */}
        {lockMove && currentTool === 'select' && (
          <>
            <span className={isDark ? 'text-[#444]' : 'text-gray-300'}>•</span>
            <span className="text-[#F43F5E] font-medium">Lock Move (L)</span>
          </>
        )}
      </div>
    </div>
  );
};
