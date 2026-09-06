import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BooleanOperation,
  CanvasDimensions,
  Guide,
  GuideAlignType,
  GuideAxis,
  PathPoint,
  PointAlignType,
  ShapePresetType,
  ToolMode,
  VectorShape,
} from './types';
import {
  alignPoints,
  alignShapes,
  alignShapesToGuide,
  ObjectAlignType,
} from './utils/alignment';
import { createGuide, resolvePickedGuide } from './utils/guides';
import { FlipDirection, flipShapes, mirrorShape } from './utils/mirror';
import {
  edgeMidpoint,
  PARALLEL_EPSILON_DEG,
  parallelRotation,
  resolveParallelEdge,
} from './utils/parallel';
import {
  getShapeBounds,
  unbreakHandles,
  updatePointType,
} from './utils/bezier';
import {
  flattenAllShapes,
  groupShapesIntoCompound,
  performBooleanOperation,
} from './utils/booleanOps';
import { detectOverlays } from './utils/overlayDetector';
import { duplicateShape } from './utils/duplicate';
import {
  clampNudgeStep,
  directionFromKey,
  NudgeDirection,
  nudgeDelta,
  nudgePoints,
  nudgeShapes,
  NUDGE_DEFAULT_STEP,
  NUDGE_HISTORY_GAP_MS,
  NUDGE_SHIFT_MULTIPLIER,
} from './utils/nudge';
import {
  clampRotateStep,
  resolveRotateCenter,
  RotateOrigin,
  rotateShapes,
  ROTATE_DEFAULT_STEP,
} from './utils/rotate';
import { buildRectPoints, cornerRadiusPx, createPresetShape } from './utils/shapePresets';
import { parseSvgToVectorShapes, svgToRasterSource } from './utils/vectorTrace';

import { AlignCenter, Combine, Move, Palette, RotateCw, Ruler } from 'lucide-react';

import { AlignTab } from './components/AlignTab';
import { CanvasArea } from './components/CanvasArea';
import { CanvaGuideModal } from './components/CanvaGuideModal';
import { DropZoneOverlay } from './components/DropZoneOverlay';
import { ExportModal } from './components/ExportModal';
import { GuidesPanel } from './components/GuidesPanel';
import { ImageTraceModal } from './components/ImageTraceModal';
import { LayersPanel } from './components/LayersPanel';
import { MergeTab } from './components/MergeTab';
import { NewProjectModal } from './components/NewProjectModal';
import { NudgePanel } from './components/NudgePanel';
import { PenInspector } from './components/PenInspector';
import { PropertiesPanel } from './components/PropertiesPanel';
import { RotatePanel } from './components/RotatePanel';
import { TabbedSection } from './components/TabbedSection';
import { ToolRail } from './components/ToolRail';
import { Toolbar } from './components/Toolbar';
import { ThemeProvider } from './context/ThemeContext';

function CanvaFrameApp() {
  // Canvas configuration
  const [dimensions, setDimensions] = useState<CanvasDimensions>({
    width: 1080,
    height: 1080,
    name: 'Instagram Post / Square',
  });

  // Shapes list - default blank canvas
  const [shapes, setShapes] = useState<VectorShape[]>([]);

  // Tool & selection state
  const [currentTool, setCurrentTool] = useState<ToolMode>('select');
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number>(0.65);
  const [fitSignal, setFitSignal] = useState(0);

  // Rulers & guides. Guides are chrome, not artwork: they never reach the
  // export and are deliberately kept out of the shape history, so undoing a
  // move does not also resurrect a guide you meant to clear.
  const [guides, setGuides] = useState<Guide[]>([]);
  const [selectedGuideIds, setSelectedGuideIds] = useState<string[]>([]);
  const [showRulers, setShowRulers] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [snapToGuides, setSnapToGuides] = useState(true);

  // Delete acts on whatever was picked most recently, so a stale guide
  // selection cannot swallow a Delete meant for the shape, or vice versa.
  const [lastPicked, setLastPicked] = useState<'shape' | 'guide'>('shape');

  // Undo / Redo history
  const [history, setHistory] = useState<{
    past: { shapes: VectorShape[]; dimensions: CanvasDimensions }[];
    future: { shapes: VectorShape[]; dimensions: CanvasDimensions }[];
  }>({
    past: [],
    future: [],
  });

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [traceModalData, setTraceModalData] = useState<{
    isOpen: boolean;
    imageSrc: string;
    filename: string;
    isNewProject: boolean;
  }>({
    isOpen: false,
    imageSrc: '',
    filename: '',
    isNewProject: false,
  });

  // Drag & drop file import
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragDepth = useRef(0);

  // Push history entry
  const recordHistory = useCallback(
    (newShapes: VectorShape[], newDims = dimensions) => {
      setHistory((prev) => ({
        past: [...prev.past.slice(-30), { shapes, dimensions }],
        future: [],
      }));
    },
    [shapes, dimensions]
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);
      setShapes(previous.shapes);
      setDimensions(previous.dimensions);
      return {
        past: newPast,
        future: [{ shapes, dimensions }, ...prev.future],
      };
    });
  }, [shapes, dimensions]);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      setShapes(next.shapes);
      setDimensions(next.dimensions);
      return {
        past: [...prev.past, { shapes, dimensions }],
        future: newFuture,
      };
    });
  }, [shapes, dimensions]);

  // Copy/paste buffer. Kept in the app rather than the system clipboard: these
  // are shape objects, and the system clipboard would only carry a serialised
  // form that other apps could not use anyway.
  const clipboard = useRef<VectorShape[]>([]);
  const pasteRun = useRef(0);

  // Switching to Select drops any point sub-selection, so the rail and the
  // keyboard must go through the same path or they drift apart.
  const selectTool = useCallback((tool: ToolMode) => {
    setCurrentTool(tool);
    if (tool === 'select') setSelectedPointIds([]);
  }, []);

  const handleCopy = useCallback(() => {
    const picked = shapes.filter((s) => selectedShapeIds.includes(s.id));
    if (picked.length === 0) return false;
    clipboard.current = picked.map((s) => structuredClone(s));
    // Each run of pastes steps further from the original.
    pasteRun.current = 0;
    return true;
  }, [shapes, selectedShapeIds]);

  const handlePaste = useCallback(() => {
    if (clipboard.current.length === 0) return false;
    recordHistory(shapes, dimensions);

    pasteRun.current += 1;
    const offset = 25 * pasteRun.current;
    const pasted = clipboard.current.map((s) => duplicateShape(s, offset, offset));

    setShapes((prev) => [...prev, ...pasted]);
    setSelectedShapeIds(pasted.map((s) => s.id));
    setSelectedPointIds([]);
    return true;
  }, [shapes, dimensions, recordHistory]);

  // Selected shapes references. Declared up here because the tools below —
  // nudging, rotating, mirroring, Parallel — all read them, and a `const` used
  // in a hook's dependency array has to exist by the time that array is built.
  const selectedShapes = useMemo(() => {
    return shapes.filter((s) => selectedShapeIds.includes(s.id));
  }, [shapes, selectedShapeIds]);

  const activeShape = selectedShapes[0] || null;

  // --- Arrow-key nudging ---
  // The step is held as typed so the field can be emptied or left mid-number
  // ("0."); every move uses the clamped value.
  const [nudgeStepText, setNudgeStepText] = useState(String(NUDGE_DEFAULT_STEP));
  const nudgeStep = clampNudgeStep(Number(nudgeStepText));
  const lastNudgeAt = useRef(0);

  // Lock Move (L): while on, dragging a selection with the Select tool is held
  // to one axis. A mode rather than a held key, so a long drag does not need a
  // finger parked on the keyboard for its whole length.
  const [lockMove, setLockMove] = useState(false);

  /**
   * What the arrow keys act on. Guides win only when one was the last thing
   * picked — the same rule Delete follows — so a stale guide selection cannot
   * swallow a nudge meant for the shape.
   */
  const nudgeTarget: 'shapes' | 'points' | 'guides' | null = useMemo(() => {
    if (lastPicked === 'guide' && selectedGuideIds.length > 0) return 'guides';
    if (selectedPointIds.length > 0) return 'points';
    if (selectedShapeIds.length > 0) return 'shapes';
    return null;
  }, [lastPicked, selectedGuideIds, selectedPointIds, selectedShapeIds]);

  const handleNudge = useCallback(
    (direction: NudgeDirection, big: boolean) => {
      if (nudgeTarget === null) return;
      const { dx, dy } = nudgeDelta(
        direction,
        nudgeStep * (big ? NUDGE_SHIFT_MULTIPLIER : 1)
      );

      if (nudgeTarget === 'guides') {
        // A guide only moves across its own axis, so a horizontal guide
        // ignores Left/Right. Guides stay out of the history, as when dragged.
        const axis: GuideAxis = dx !== 0 ? 'x' : 'y';
        const delta = dx !== 0 ? dx : dy;
        setGuides((prev) =>
          prev.map((g) =>
            g.axis === axis && selectedGuideIds.includes(g.id)
              ? { ...g, position: g.position + delta }
              : g
          )
        );
        return;
      }

      const now = Date.now();
      if (now - lastNudgeAt.current > NUDGE_HISTORY_GAP_MS) {
        recordHistory(shapes, dimensions);
      }
      lastNudgeAt.current = now;

      if (nudgeTarget === 'points') {
        setShapes((prev) =>
          prev.map((s) => {
            const points = nudgePoints(s.points, selectedPointIds, dx, dy);
            return points === s.points ? s : { ...s, points };
          })
        );
      } else {
        setShapes((prev) => nudgeShapes(prev, selectedShapeIds, dx, dy));
      }
    },
    [
      nudgeTarget,
      nudgeStep,
      selectedGuideIds,
      selectedPointIds,
      selectedShapeIds,
      recordHistory,
      shapes,
      dimensions,
    ]
  );

  // --- Rotation ---
  // Shapes carry no rotation field — geometry is a bezier point list — so a
  // turn is baked into the coordinates and only ever relative. The angle is
  // held as typed so the field can be emptied mid-number.
  const [rotateAngleText, setRotateAngleText] = useState(
    String(ROTATE_DEFAULT_STEP)
  );
  const rotateAngle = clampRotateStep(Number(rotateAngleText));
  const [rotateOrigin, setRotateOrigin] = useState<RotateOrigin>('selection');

  /**
   * Turn the selection by `deltaDeg`, clockwise for a positive angle.
   *
   * The pivot follows the Pivot toggle: the centre of the whole selection, so
   * the shapes turn together as a block, or each shape's own centre, so they
   * spin in place. The canvas handle always uses the selection centre, since
   * that is the box it is attached to.
   */
  const handleRotate = useCallback(
    (deltaDeg: number) => {
      if (selectedShapeIds.length === 0 || deltaDeg % 360 === 0) return;
      const center = resolveRotateCenter(shapes, selectedShapeIds, rotateOrigin);
      if (rotateOrigin === 'selection' && !center) return;

      recordHistory(shapes, dimensions);
      setShapes(rotateShapes(shapes, selectedShapeIds, deltaDeg, center));
      setSelectedPointIds([]);
    },
    [shapes, selectedShapeIds, rotateOrigin, dimensions, recordHistory]
  );

  /**
   * Flip the selection left-for-right or top-for-bottom.
   *
   * The reflection is about the centre, so the bounding box stays exactly where
   * it is and only the facing changes — unlike Mirror, which drops a reflected
   * copy on the far side of a guide. The pivot follows the same Pivot toggle
   * rotation uses: the whole selection flips as a block, or each shape flips in
   * place.
   */
  const handleFlip = useCallback(
    (direction: FlipDirection) => {
      if (selectedShapeIds.length === 0) return;
      const center = resolveRotateCenter(shapes, selectedShapeIds, rotateOrigin);
      if (rotateOrigin === 'selection' && !center) return;

      recordHistory(shapes, dimensions);
      setShapes(flipShapes(shapes, selectedShapeIds, direction, center));
    },
    [shapes, selectedShapeIds, rotateOrigin, dimensions, recordHistory]
  );

  // --- Mirror across a guide ---
  // The guide to reflect across is whichever was picked last, falling back to
  // the only guide on the canvas when there is exactly one.
  const mirrorGuide = useMemo(
    () => resolvePickedGuide(guides, selectedGuideIds),
    [guides, selectedGuideIds]
  );

  const canMirror = selectedShapeIds.length > 0 && mirrorGuide !== null;

  const mirrorHint = useMemo(() => {
    if (mirrorGuide && selectedShapeIds.length > 0) {
      const axis = mirrorGuide.axis === 'x' ? 'vertical' : 'horizontal';
      return `Reflect a copy across the ${axis} guide at ${Math.round(
        mirrorGuide.position
      )}`;
    }
    if (guides.length === 0) {
      return 'Drag a guide out of a ruler, select a shape, then reflect a copy across it.';
    }
    if (selectedShapeIds.length === 0 && !mirrorGuide) {
      return 'Select a shape and click a guide to reflect a copy across it.';
    }
    if (selectedShapeIds.length === 0) {
      return 'Select a shape to reflect across the guide.';
    }
    return 'Click a guide on the canvas to choose which one to mirror across.';
  }, [mirrorGuide, selectedShapeIds, guides]);

  /**
   * Reflect every selected shape across the active guide, as a new object.
   *
   * Distance is preserved, so a shape 5px to the left of a vertical guide is
   * copied 5px to its right. The original is left where it is and the copies
   * become the selection — the guide stays selected, so the next shape can be
   * mirrored across the same line without re-picking it.
   */
  const handleMirror = useCallback(() => {
    if (!mirrorGuide || selectedShapeIds.length === 0) return;
    recordHistory(shapes, dimensions);

    const copies = shapes
      .filter((s) => selectedShapeIds.includes(s.id))
      .map((s) => mirrorShape(s, mirrorGuide.axis, mirrorGuide.position));

    setShapes((prev) => [...prev, ...copies]);
    setSelectedShapeIds(copies.map((s) => s.id));
    setSelectedPointIds([]);
    setLastPicked('shape');
  }, [mirrorGuide, selectedShapeIds, shapes, dimensions, recordHistory]);

  // --- Parallel: turn an edge until it runs along a guide ---
  // The edge is the two anchor points picked under Sub-Select; the guide is
  // resolved exactly as Mirror's is, so the two tools are driven the same way.
  const parallelEdge = useMemo(
    () => (activeShape ? resolveParallelEdge(activeShape, selectedPointIds) : null),
    [activeShape, selectedPointIds]
  );

  /** Turn needed to bring the edge parallel to the guide, clockwise-positive. */
  const parallelAngle = useMemo(() => {
    if (!parallelEdge || !mirrorGuide) return null;
    return parallelRotation(parallelEdge, mirrorGuide.axis);
  }, [parallelEdge, mirrorGuide]);

  const canParallel =
    activeShape !== null &&
    !activeShape.locked &&
    parallelAngle !== null &&
    Math.abs(parallelAngle) >= PARALLEL_EPSILON_DEG;

  const parallelHint = useMemo(() => {
    if (!activeShape) {
      return 'Select a shape, then pick the two points at either end of one of its edges.';
    }
    if (guides.length === 0) {
      return 'Drag a guide out of a ruler to give the edge a line to run along.';
    }
    if (!mirrorGuide) {
      return 'Click a guide on the canvas to choose which one the edge should run along.';
    }
    if (!parallelEdge) {
      return selectedPointIds.length > 2
        ? 'Pick just two points — the ends of the edge to line up.'
        : 'Switch to Sub-Select (W) and click one end of the edge, then shift-click the other.';
    }
    if (activeShape.locked) {
      return 'This shape is locked. Unlock it in Layers to rotate it.';
    }

    const axis = mirrorGuide.axis === 'x' ? 'vertical' : 'horizontal';
    const at = `${mirrorGuide.axis === 'x' ? 'X' : 'Y'} ${Math.round(
      mirrorGuide.position
    )}`;
    if (parallelAngle === null || Math.abs(parallelAngle) < PARALLEL_EPSILON_DEG) {
      return `The edge is already parallel to the ${axis} guide at ${at}.`;
    }
    return `Turn ${Math.abs(parallelAngle).toFixed(1)}° ${
      parallelAngle > 0 ? 'clockwise' : 'anticlockwise'
    } so the edge runs along the ${axis} guide at ${at}.`;
  }, [
    activeShape,
    guides,
    mirrorGuide,
    parallelEdge,
    parallelAngle,
    selectedPointIds,
  ]);

  /**
   * Rotate the selection until the picked edge is parallel to the guide.
   *
   * The turn pivots on the middle of the edge, so the edge stays where it is
   * and only the rest of the shape swings; "Align to Guide" then slides it
   * flush. It is always the shorter way round — never more than a quarter turn
   * — because a line reversed is the same line.
   *
   * The point selection is left alone, so the same edge can be sent at another
   * guide straight afterwards.
   */
  const handleParallel = useCallback(() => {
    if (!canParallel || !parallelEdge || parallelAngle === null) return;
    recordHistory(shapes, dimensions);
    setShapes(
      rotateShapes(
        shapes,
        selectedShapeIds,
        parallelAngle,
        edgeMidpoint(parallelEdge)
      )
    );
  }, [
    canParallel,
    parallelEdge,
    parallelAngle,
    selectedShapeIds,
    shapes,
    dimensions,
    recordHistory,
  ]);

  /**
   * Move every selected shape one step up or down the stack.
   *
   * The keyboard twin of the Layers panel's chevrons, but selection-wide: with
   * several layers picked, each one steps past the nearest *unselected*
   * neighbour, so a multi-selection travels as a block and keeps its internal
   * order instead of collapsing on itself. Sweeping from the leading edge means
   * a shape that has already moved is never moved twice in one pass.
   *
   * A selection already pinned against the top (or bottom) moves nothing, and
   * records no history entry — an undo that does nothing visible is worse than
   * no undo at all.
   */
  const handleReorderSelection = useCallback(
    (direction: 'up' | 'down') => {
      if (selectedShapeIds.length === 0) return;

      const next = [...shapes];
      const isSelected = (s: VectorShape) => selectedShapeIds.includes(s.id);
      let moved = false;

      if (direction === 'up') {
        // Higher index is nearer the front, so walk down from the top.
        for (let i = next.length - 2; i >= 0; i--) {
          if (isSelected(next[i]) && !isSelected(next[i + 1])) {
            [next[i], next[i + 1]] = [next[i + 1], next[i]];
            moved = true;
          }
        }
      } else {
        for (let i = 1; i < next.length; i++) {
          if (isSelected(next[i]) && !isSelected(next[i - 1])) {
            [next[i], next[i - 1]] = [next[i - 1], next[i]];
            moved = true;
          }
        }
      }

      if (!moved) return;
      recordHistory(shapes, dimensions);
      setShapes(next);
    },
    [selectedShapeIds, shapes, dimensions, recordHistory]
  );

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Q, W, E, A, L, M, P, Shift+H/V,
  // Shift+(/), arrows, Delete). "S" opens the shapes flyout and is handled in
  // ToolRail, which owns that state — leave it unbound here.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      const nudgeDir = directionFromKey(e.key);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom((z) => Math.min(3, Math.round((z + 0.1) * 100) / 100));
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(0.2, Math.round((z - 0.1) * 100) / 100));
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        setFitSignal((n) => n + 1);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        // Only swallow the browser's own copy when there was something to take.
        if (handleCopy()) e.preventDefault();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        if (handlePaste()) e.preventDefault();
      } else if (e.metaKey || e.ctrlKey || e.altKey) {
        // Leave every other browser/OS chord alone: without this, Cmd+S,
        // Cmd+A and Cmd+P all fall through and switch tools.
        return;
      } else if (e.key.toLowerCase() === 'q') {
        selectTool('select');
      } else if (e.key.toLowerCase() === 'w') {
        selectTool('directSelect');
      } else if (e.key.toLowerCase() === 'e') {
        selectTool('pen');
      } else if (e.key.toLowerCase() === 'a') {
        selectTool('addPoint');
      } else if (e.key.toLowerCase() === 'r') {
        setShowRulers((v) => !v);
      } else if (e.key.toLowerCase() === 'g') {
        setShowGuides((v) => !v);
      } else if (e.key.toLowerCase() === 'l') {
        setLockMove((v) => !v);
      } else if (e.key.toLowerCase() === 'm') {
        handleMirror();
      } else if (e.key.toLowerCase() === 'p') {
        handleParallel();
      } else if (e.shiftKey && e.key.toLowerCase() === 'h') {
        // Shift-qualified so the bare letters stay free for future tools, and
        // so a stray keypress cannot flip a shape without meaning to.
        handleFlip('horizontal');
      } else if (e.shiftKey && e.key.toLowerCase() === 'v') {
        handleFlip('vertical');
      } else if (e.shiftKey && (e.key === ')' || e.code === 'Digit0')) {
        // Shift+) / Shift+( walk the selection up and down the layer stack.
        // The pair reads as the closing/opening bracket of the stack, and sits
        // on 0/9 so it never collides with a tool letter. `e.code` is the
        // fallback for layouts where shifted 0/9 are not parentheses.
        e.preventDefault();
        handleReorderSelection('up');
      } else if (e.shiftKey && (e.key === '(' || e.code === 'Digit9')) {
        e.preventDefault();
        handleReorderSelection('down');
      } else if (nudgeDir) {
        // Without this the workspace scrolls under the arrow keys instead.
        e.preventDefault();
        handleNudge(nudgeDir, e.shiftKey);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleCopy,
    handlePaste,
    selectTool,
    handleNudge,
    handleMirror,
    handleParallel,
    handleFlip,
    handleReorderSelection,
    selectedPointIds,
    selectedShapeIds,
    selectedGuideIds,
    lastPicked,
  ]);

  const selectedPoint = useMemo(() => {
    if (!activeShape || selectedPointIds.length !== 1) return null;
    return activeShape.points.find((p) => p.id === selectedPointIds[0]) || null;
  }, [activeShape, selectedPointIds]);

  // Overlays detection
  const overlayStatus = useMemo(() => {
    return detectOverlays(shapes);
  }, [shapes]);

  // --- Dimension Crop / Scale ---
  const handleUpdateDimensions = (
    newDims: CanvasDimensions,
    mode: 'crop' | 'scale'
  ) => {
    recordHistory(shapes, dimensions);

    if (mode === 'scale' && dimensions.width > 0 && dimensions.height > 0) {
      const scaleX = newDims.width / dimensions.width;
      const scaleY = newDims.height / dimensions.height;

      const scaledShapes = shapes.map((shape) => ({
        ...shape,
        points: shape.points.map((p) => ({
          ...p,
          x: Math.round(p.x * scaleX * 100) / 100,
          y: Math.round(p.y * scaleY * 100) / 100,
          cp1: p.cp1
            ? {
                x: Math.round(p.cp1.x * scaleX * 100) / 100,
                y: Math.round(p.cp1.y * scaleY * 100) / 100,
              }
            : undefined,
          cp2: p.cp2
            ? {
                x: Math.round(p.cp2.x * scaleX * 100) / 100,
                y: Math.round(p.cp2.y * scaleY * 100) / 100,
              }
            : undefined,
        })),
      }));
      setShapes(scaledShapes);
    }

    setDimensions(newDims);
  };

  // --- File Upload & Vectorization Handler ---
  const handleFileSelected = (file: File, isNewProject: boolean) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (ext === 'svg') {
      // Direct SVG vector parsing
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        try {
          const { shapes: parsedShapes, width, height } =
            parseSvgToVectorShapes(text);

          if (parsedShapes.length === 0) {
            // Common case: a bitmap exported inside an <svg> wrapper. There is
            // nothing to read as vectors, so hand the pixels to the tracer.
            try {
              const imageSrc = await svgToRasterSource(text);
              setTraceModalData({
                isOpen: true,
                imageSrc,
                filename: file.name,
                isNewProject,
              });
            } catch (rasterErr) {
              console.error('SVG rasterize error:', rasterErr);
              alert(
                'No vector shapes found in SVG, and it could not be traced as an image.'
              );
            }
            return;
          }

          recordHistory(shapes, dimensions);

          if (isNewProject) {
            setDimensions({ width, height, name: file.name });
            setShapes(parsedShapes);
            setSelectedShapeIds([parsedShapes[0].id]);
          } else {
            // Import into existing canvas
            setShapes((prev) => [...prev, ...parsedShapes]);
            setSelectedShapeIds(parsedShapes.map((s) => s.id));
          }
        } catch (err) {
          console.error('SVG parse error:', err);
          alert('Could not parse SVG vector lines. Please check the file.');
        }
      };
      reader.readAsText(file);
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      // Raster image: open Image Trace Outliner modal
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        setTraceModalData({
          isOpen: true,
          imageSrc,
          filename: file.name,
          isNewProject,
        });
      };
      reader.readAsDataURL(file);
    } else {
      alert('Supported file formats: SVG, PNG, JPG, JPEG, WEBP.');
    }
  };

  // --- Drag & Drop Import ---
  const isAnyModalOpen =
    isNewModalOpen || isExportModalOpen || isGuideModalOpen || traceModalData.isOpen;

  const dragCarriesFile = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types || []).includes('Files');

  const resetDragState = () => {
    dragDepth.current = 0;
    setIsDraggingFile(false);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (isAnyModalOpen || !dragCarriesFile(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isAnyModalOpen || !dragCarriesFile(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isDraggingFile) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) resetDragState();
  };

  // Stop the browser from navigating away when a file lands outside a drop zone
  useEffect(() => {
    const swallow = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', swallow);
    window.addEventListener('drop', swallow);
    return () => {
      window.removeEventListener('dragover', swallow);
      window.removeEventListener('drop', swallow);
    };
  }, []);

  const handleTraceConfirm = (
    newShapes: VectorShape[],
    imgDim: { width: number; height: number },
    replaceCanvas: boolean
  ) => {
    recordHistory(shapes, dimensions);

    if (replaceCanvas) {
      setDimensions({ width: imgDim.width, height: imgDim.height, name: 'Traced Frame' });
      setShapes(newShapes);
      setSelectedShapeIds(newShapes.map((s) => s.id));
    } else {
      setShapes((prev) => [...prev, ...newShapes]);
      setSelectedShapeIds(newShapes.map((s) => s.id));
    }
  };

  // --- Add Preset Basic Shape ---
  const handleAddPresetShape = (type: ShapePresetType) => {
    recordHistory(shapes, dimensions);
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const size = Math.min(dimensions.width, dimensions.height) * 0.45;

    const newShape = createPresetShape(type, cx, cy, size);
    setShapes((prev) => [...prev, newShape]);
    setSelectedShapeIds([newShape.id]);
    setSelectedPointIds([]);
    setCurrentTool('select');
  };

  // --- Point & Handle Operations ---
  const handleUpdatePointType = (type: 'straight' | 'rounded' | 'break') => {
    if (!activeShape || selectedPointIds.length !== 1) return;
    recordHistory(shapes, dimensions);

    const ptId = selectedPointIds[0];
    const idx = activeShape.points.findIndex((p) => p.id === ptId);
    if (idx === -1) return;

    const prevPt =
      activeShape.points[(idx - 1 + activeShape.points.length) % activeShape.points.length];
    const nextPt =
      activeShape.points[(idx + 1) % activeShape.points.length];

    const updatedPt = updatePointType(activeShape.points[idx], type, prevPt, nextPt);

    const updatedPoints = activeShape.points.map((p) => (p.id === ptId ? updatedPt : p));
    setShapes((prev) =>
      prev.map((s) => (s.id === activeShape.id ? { ...s, points: updatedPoints } : s))
    );
  };

  const handleUnbreakHandles = () => {
    if (!activeShape || selectedPointIds.length !== 1) return;
    recordHistory(shapes, dimensions);

    const ptId = selectedPointIds[0];
    const updatedPoints = activeShape.points.map((p) =>
      p.id === ptId ? unbreakHandles(p) : p
    );

    setShapes((prev) =>
      prev.map((s) => (s.id === activeShape.id ? { ...s, points: updatedPoints } : s))
    );
  };

  const handleAlignPoints = (alignType: PointAlignType) => {
    if (!activeShape || selectedPointIds.length < 2) return;
    recordHistory(shapes, dimensions);

    const updatedPoints = alignPoints(activeShape.points, selectedPointIds, alignType);
    setShapes((prev) =>
      prev.map((s) => (s.id === activeShape.id ? { ...s, points: updatedPoints } : s))
    );
  };

  const handleDeleteSelectedPoints = () => {
    if (!activeShape || selectedPointIds.length === 0) return;
    recordHistory(shapes, dimensions);

    const remaining = activeShape.points.filter((p) => !selectedPointIds.includes(p.id));
    if (remaining.length < 2) {
      // Remove entire shape
      setShapes((prev) => prev.filter((s) => s.id !== activeShape.id));
      setSelectedShapeIds([]);
      setSelectedPointIds([]);
    } else {
      setShapes((prev) =>
        prev.map((s) => (s.id === activeShape.id ? { ...s, points: remaining } : s))
      );
      setSelectedPointIds([]);
    }
  };

  const handleToggleClosePath = () => {
    if (!activeShape) return;
    recordHistory(shapes, dimensions);
    setShapes((prev) =>
      prev.map((s) =>
        s.id === activeShape.id ? { ...s, closed: !s.closed } : s
      )
    );
  };

  // Joining an in-progress pen path back to its first anchor. Unlike the
  // open/closed toggle this also leaves the pen: a closed frame is finished,
  // and staying in the tool would only scatter stray points over it.
  const canClosePath =
    currentTool === 'pen' &&
    activeShape !== null &&
    !activeShape.closed &&
    activeShape.points.length >= 3;

  const handleClosePath = () => {
    if (!canClosePath || !activeShape) return;
    recordHistory(shapes, dimensions);
    setShapes((prev) =>
      prev.map((s) => (s.id === activeShape.id ? { ...s, closed: true } : s))
    );
    setCurrentTool('select');
  };

  const handleUpdatePointCoords = (x: number, y: number) => {
    if (!activeShape || selectedPointIds.length !== 1) return;
    const ptId = selectedPointIds[0];
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== activeShape.id) return s;
        return {
          ...s,
          points: s.points.map((p) => {
            if (p.id !== ptId) return p;
            const dx = x - p.x;
            const dy = y - p.y;
            return {
              ...p,
              x,
              y,
              cp1: p.cp1 ? { x: p.cp1.x + dx, y: p.cp1.y + dy } : undefined,
              cp2: p.cp2 ? { x: p.cp2.x + dx, y: p.cp2.y + dy } : undefined,
            };
          }),
        };
      })
    );
  };

  // --- Boolean Operations (Each action creates a new object) ---
  const handleBooleanOperation = (op: BooleanOperation) => {
    if (selectedShapes.length < 2) return;
    recordHistory(shapes, dimensions);

    try {
      const newObjects = performBooleanOperation(op, selectedShapes);
      const remainingShapes = shapes.filter((s) => !selectedShapeIds.includes(s.id));
      const nextShapes = [...remainingShapes, ...newObjects];
      setShapes(nextShapes);
      setSelectedShapeIds(newObjects.map((s) => s.id));
      setSelectedPointIds([]);
    } catch (err: any) {
      alert(`Boolean operation failed: ${err.message || err}`);
    }
  };

  const handleGroupShapes = () => {
    if (selectedShapes.length < 2) return;
    recordHistory(shapes, dimensions);

    const grouped = groupShapesIntoCompound(selectedShapes);
    const remaining = shapes.filter((s) => !selectedShapeIds.includes(s.id));
    setShapes([...remaining, grouped]);
    setSelectedShapeIds([grouped.id]);
    setSelectedPointIds([]);
  };

  const handleFlattenShapes = () => {
    recordHistory(shapes, dimensions);
    try {
      const flattened = flattenAllShapes(shapes);
      setShapes([flattened]);
      setSelectedShapeIds([flattened.id]);
      setSelectedPointIds([]);
    } catch (err: any) {
      alert(`Flatten failed: ${err.message || err}`);
    }
  };

  // --- Corner radius on rectangles ---
  const handleUpdateCornerRadius = (pct: number) => {
    if (!activeShape || activeShape.cornerRadiusPct === undefined) return;
    recordHistory(shapes, dimensions);
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== activeShape.id || s.cornerRadiusPct === undefined) return s;
        // Rebuild from the shape's current box so the radius survives moves and
        // resizes rather than snapping back to where the rectangle started.
        const b = getShapeBounds(s);
        return {
          ...s,
          cornerRadiusPct: pct,
          points: buildRectPoints(
            s.id,
            b.minX,
            b.minY,
            b.maxX,
            b.maxY,
            cornerRadiusPx(pct, b.width, b.height)
          ),
        };
      })
    );
    setSelectedPointIds([]);
  };

  // --- Align Objects ---
  const handleAlignObjects = (type: ObjectAlignType) => {
    if (selectedShapeIds.length < 2) return;
    recordHistory(shapes, dimensions);
    const aligned = alignShapes(shapes, selectedShapeIds, type);
    setShapes(aligned);
  };

  // --- Rulers & Guides ---
  const handleAddGuide = (guide: Guide) => {
    setGuides((prev) => [...prev, guide]);
  };

  const handleUpdateGuide = (id: string, position: number) => {
    setGuides((prev) =>
      prev.map((g) => (g.id === id ? { ...g, position } : g))
    );
  };

  const handleDeleteGuide = (id: string) => {
    setGuides((prev) => prev.filter((g) => g.id !== id));
    setSelectedGuideIds((prev) => prev.filter((x) => x !== id));
  };

  const handleDeleteSelectedGuides = () => {
    if (selectedGuideIds.length === 0) return;
    setGuides((prev) => prev.filter((g) => !selectedGuideIds.includes(g.id)));
    setSelectedGuideIds([]);
  };

  const handleSelectGuide = (id: string, multi: boolean) => {
    setLastPicked('guide');
    setSelectedGuideIds((prev) => {
      if (!multi) return [id];
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  const handleClearGuides = () => {
    setGuides([]);
    setSelectedGuideIds([]);
  };

  /**
   * Drop guides down the middle of the canvas. A centre guide that is already
   * there is selected rather than duplicated, so pressing the button twice
   * leaves one line, not two stacked on the same pixel.
   */
  const handleAddCenterGuides = (axis: GuideAxis | 'both') => {
    const wanted: { axis: GuideAxis; position: number }[] = [];
    if (axis === 'x' || axis === 'both') {
      wanted.push({ axis: 'x', position: Math.round(dimensions.width / 2) });
    }
    if (axis === 'y' || axis === 'both') {
      wanted.push({ axis: 'y', position: Math.round(dimensions.height / 2) });
    }

    const next = [...guides];
    const picked: string[] = [];

    wanted.forEach((w) => {
      const existing = next.find(
        (g) => g.axis === w.axis && Math.abs(g.position - w.position) < 0.5
      );
      if (existing) {
        picked.push(existing.id);
        return;
      }
      const created = createGuide(w.axis, w.position);
      next.push(created);
      picked.push(created.id);
    });

    setGuides(next);
    setSelectedGuideIds(picked);
    setLastPicked('guide');
    setShowGuides(true);
  };

  const handleAlignToGuide = (alignType: GuideAlignType, position: number) => {
    if (selectedShapeIds.length === 0) return;
    recordHistory(shapes, dimensions);
    setShapes(alignShapesToGuide(shapes, selectedShapeIds, alignType, position));
  };

  const handleCenterOnGuides = (x?: number, y?: number) => {
    if (selectedShapeIds.length === 0 || (x === undefined && y === undefined)) return;
    recordHistory(shapes, dimensions);

    let next = shapes;
    if (x !== undefined) {
      next = alignShapesToGuide(next, selectedShapeIds, 'centerX', x);
    }
    if (y !== undefined) {
      next = alignShapesToGuide(next, selectedShapeIds, 'centerY', y);
    }
    setShapes(next);
  };

  // --- Layers Panel Actions ---
  const handleToggleVisibility = (id: string) => {
    setShapes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  };

  const handleToggleLock = (id: string) => {
    setShapes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s))
    );
  };

  const handleReorderLayer = (id: string, direction: 'up' | 'down') => {
    recordHistory(shapes, dimensions);
    const idx = shapes.findIndex((s) => s.id === id);
    if (idx === -1) return;

    const newShapes = [...shapes];
    if (direction === 'up' && idx < newShapes.length - 1) {
      // In shapes array, higher index is top (forward)
      const temp = newShapes[idx];
      newShapes[idx] = newShapes[idx + 1];
      newShapes[idx + 1] = temp;
    } else if (direction === 'down' && idx > 0) {
      const temp = newShapes[idx];
      newShapes[idx] = newShapes[idx - 1];
      newShapes[idx - 1] = temp;
    }
    setShapes(newShapes);
  };

  const handleDuplicateLayer = (id: string) => {
    const target = shapes.find((s) => s.id === id);
    if (!target) return;
    recordHistory(shapes, dimensions);

    const dup = duplicateShape(target);

    setShapes((prev) => [...prev, dup]);
    setSelectedShapeIds([dup.id]);
  };

  const handleDeleteSelectedShapes = () => {
    if (selectedShapeIds.length === 0) return;
    recordHistory(shapes, dimensions);
    setShapes((prev) => prev.filter((s) => !selectedShapeIds.includes(s.id)));
    setSelectedShapeIds([]);
    setSelectedPointIds([]);
  };

  // What Delete (and the toolbar's trash button) acts on: the most recently
  // picked thing wins, so a stale guide selection cannot swallow a delete
  // meant for the shape.
  const deleteTarget: 'guide' | 'point' | 'shape' | null =
    lastPicked === 'guide' && selectedGuideIds.length > 0
      ? 'guide'
      : selectedPointIds.length > 0
      ? 'point'
      : selectedShapeIds.length > 0
      ? 'shape'
      : null;

  const handleDeleteSelection = () => {
    if (deleteTarget === 'guide') handleDeleteSelectedGuides();
    else if (deleteTarget === 'point') handleDeleteSelectedPoints();
    else if (deleteTarget === 'shape') handleDeleteSelectedShapes();
  };

  const handleRenameLayer = (id: string, newName: string) => {
    setShapes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
    );
  };

  const handleUpdateShapeStyle = (
    updates: Partial<Pick<VectorShape, 'fillColor' | 'strokeColor' | 'strokeWidth' | 'opacity'>>
  ) => {
    if (selectedShapeIds.length === 0) return;
    setShapes((prev) =>
      prev.map((s) =>
        selectedShapeIds.includes(s.id) ? { ...s, ...updates } : s
      )
    );
  };

  return (
    <div
      className="relative flex flex-col h-screen w-screen bg-[#F3F4F6] dark:bg-[#121212] text-gray-900 dark:text-neutral-100 overflow-hidden font-sans"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={resetDragState}
    >
      {/* 1. Top Header Toolbar */}
      <Toolbar
        onNewProject={() => setIsNewModalOpen(true)}
        onFileSelected={handleFileSelected}
        onExport={() => setIsExportModalOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onDelete={handleDeleteSelection}
        deleteTarget={deleteTarget}
        zoom={zoom}
        onZoomChange={setZoom}
        onFitToScreen={() => setFitSignal((n) => n + 1)}
        hasOverlays={overlayStatus.hasOverlay}
        onOpenGuide={() => setIsGuideModalOpen(true)}
      />

      {/* 2. Main Studio Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Vertical Tool Rail */}
        <ToolRail
          currentTool={currentTool}
          onSelectTool={selectTool}
          onAddPresetShape={handleAddPresetShape}
          onMirror={handleMirror}
          canMirror={canMirror}
          mirrorHint={mirrorHint}
          onParallel={handleParallel}
          canParallel={canParallel}
          parallelHint={parallelHint}
        />

        {/* Interactive Canvas Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <CanvasArea
            dimensions={dimensions}
            shapes={shapes}
            selectedShapeIds={selectedShapeIds}
            selectedPointIds={selectedPointIds}
            currentTool={currentTool}
            zoom={zoom}
            onZoomChange={setZoom}
            fitSignal={fitSignal}
            guides={guides}
            selectedGuideIds={selectedGuideIds}
            showRulers={showRulers}
            showGuides={showGuides}
            snapToGuides={snapToGuides}
            lockMove={lockMove}
            onAddGuide={handleAddGuide}
            onUpdateGuide={handleUpdateGuide}
            onDeleteGuide={handleDeleteGuide}
            onSelectGuide={handleSelectGuide}
            onSelectShape={(id, multi) => {
              setLastPicked('shape');
              if (multi) {
                setSelectedShapeIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                );
              } else {
                setSelectedShapeIds([id]);
              }
              setSelectedPointIds([]);
            }}
            onClearSelection={() => {
              setSelectedShapeIds([]);
              setSelectedPointIds([]);
              setSelectedGuideIds([]);
              setLastPicked('shape');
            }}
            onSelectPoint={(id, multi) => {
              setLastPicked('shape');
              if (multi) {
                setSelectedPointIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                );
              } else {
                setSelectedPointIds([id]);
              }
            }}
            onUpdateShapes={(updated) => {
              setShapes(updated);
            }}
            onUpdateActivePoints={(updatedPoints, isClosed) => {
              if (!activeShape) return;
              setShapes((prev) =>
                prev.map((s) =>
                  s.id === activeShape.id
                    ? {
                        ...s,
                        points: updatedPoints,
                        closed: isClosed !== undefined ? isClosed : s.closed,
                      }
                    : s
                )
              );
            }}
            onFinishPath={() => {
              setCurrentTool('select');
            }}
            // Canvas drags — move, resize, rotate, point and handle edits —
            // push one undo step each, on the first movement rather than on
            // mouse down so a bare click leaves no empty entry.
            onBeginTransform={() => recordHistory(shapes, dimensions)}
          />

          {/* Floating Pen & Sub-Select Inspector (Bottom-Center) */}
          {(currentTool === 'pen' ||
            currentTool === 'directSelect' ||
            currentTool === 'addPoint') && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <PenInspector
                selectedPoint={selectedPoint}
                selectedPointIds={selectedPointIds}
                totalPointsInPath={activeShape?.points.length || 0}
                isClosed={activeShape?.closed || false}
                canClosePath={canClosePath}
                onUpdatePointType={handleUpdatePointType}
                onUnbreakHandles={handleUnbreakHandles}
                onAlignPoints={handleAlignPoints}
                onDeletePoint={handleDeleteSelectedPoints}
                onToggleClosePath={handleToggleClosePath}
                onClosePath={handleClosePath}
                onUpdatePointCoords={handleUpdatePointCoords}
              />
            </div>
          )}
        </div>

        {/* Right: one scrolling column — the Align/Merge/Guides tabs, the
            Style/Move tabs, then Layers */}
        <aside
          /* No `h-full`: an unresolved percentage height would beat the flex
             row's stretch and leave the column only as tall as its content,
             showing the page behind it under the last section. */
          className="w-80 shrink-0 border-l min-h-0 overflow-y-auto select-none border-gray-200 bg-white text-gray-800 dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-neutral-200"
        >
          <TabbedSection
            tabs={[
              {
                id: 'align',
                label: 'Align',
                icon: <AlignCenter className="w-3.5 h-3.5" />,
                content: (
                  <AlignTab
                    selectedShapes={selectedShapes}
                    guides={guides}
                    selectedGuideIds={selectedGuideIds}
                    onAlignObjects={handleAlignObjects}
                    onAlignToGuide={handleAlignToGuide}
                    onCenterOnGuides={handleCenterOnGuides}
                  />
                ),
              },
              {
                id: 'merge',
                label: 'Merge',
                icon: <Combine className="w-3.5 h-3.5" />,
                badge: (
                  <span className="text-[10px] text-[#FF5722] font-medium">New Object</span>
                ),
                content: (
                  <MergeTab
                    selectedShapes={selectedShapes}
                    onBooleanOperation={handleBooleanOperation}
                    onGroupShapes={handleGroupShapes}
                    onFlattenShapes={handleFlattenShapes}
                  />
                ),
              },
              {
                id: 'guides',
                label: 'Guides',
                icon: <Ruler className="w-3.5 h-3.5" />,
                badge: (
                  <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                    {guides.length === 0
                      ? 'No guides'
                      : `${guides.length} guide${guides.length > 1 ? 's' : ''}`}
                  </span>
                ),
                content: (
                  <GuidesPanel
                    guides={guides}
                    selectedGuideIds={selectedGuideIds}
                    showRulers={showRulers}
                    showGuides={showGuides}
                    snapToGuides={snapToGuides}
                    onToggleRulers={() => setShowRulers((v) => !v)}
                    onToggleGuides={() => setShowGuides((v) => !v)}
                    onToggleSnap={() => setSnapToGuides((v) => !v)}
                    onSelectGuide={handleSelectGuide}
                    onUpdateGuide={handleUpdateGuide}
                    onDeleteGuide={handleDeleteGuide}
                    onAddCenterGuides={handleAddCenterGuides}
                    onClearGuides={handleClearGuides}
                  />
                ),
              },
            ]}
          />

          <TabbedSection
            tabs={[
              {
                id: 'style',
                label: 'Style',
                icon: <Palette className="w-3.5 h-3.5" />,
                content: (
                  <PropertiesPanel
                    selectedShapes={selectedShapes}
                    onUpdateShapeStyle={handleUpdateShapeStyle}
                    onUpdateCornerRadius={handleUpdateCornerRadius}
                  />
                ),
              },
              {
                id: 'move',
                label: 'Move',
                icon: <Move className="w-3.5 h-3.5" />,
                badge: (
                  <span className="text-[10px] font-mono text-gray-400 dark:text-neutral-500">
                    {/* The lock is a mode that outlives this tab being open,
                        so it says so even when the body is collapsed. */}
                    {lockMove && (
                      <span className="text-[#E11D48] dark:text-[#FB7185]">
                        Locked ·{' '}
                      </span>
                    )}
                    {nudgeStep} px
                  </span>
                ),
                content: (
                  <NudgePanel
                    stepText={nudgeStepText}
                    step={nudgeStep}
                    target={nudgeTarget}
                    onStepTextChange={setNudgeStepText}
                    lockMove={lockMove}
                    onToggleLockMove={() => setLockMove((v) => !v)}
                  />
                ),
              },
              {
                id: 'rotate',
                // "Transform" rather than "Rotate": the tab also holds Flip,
                // which nobody would go looking for under a rotation heading.
                label: 'Transform',
                icon: <RotateCw className="w-3.5 h-3.5" />,
                badge: (
                  <span className="text-[10px] font-mono text-gray-400 dark:text-neutral-500">
                    {rotateAngle}°
                  </span>
                ),
                content: (
                  <RotatePanel
                    selectedCount={selectedShapeIds.length}
                    angleText={rotateAngleText}
                    angle={rotateAngle}
                    origin={rotateOrigin}
                    onAngleTextChange={setRotateAngleText}
                    onOriginChange={setRotateOrigin}
                    onRotate={handleRotate}
                    onFlip={handleFlip}
                    parallelAngle={parallelAngle}
                    canParallel={canParallel}
                    parallelHint={parallelHint}
                    onParallel={handleParallel}
                  />
                ),
              },
            ]}
          />

          <LayersPanel
            shapes={shapes}
            selectedShapeIds={selectedShapeIds}
            onSelectShape={(id, multi) => {
              setLastPicked('shape');
              if (multi) {
                setSelectedShapeIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                );
              } else {
                setSelectedShapeIds([id]);
              }
              setSelectedPointIds([]);
            }}
            onToggleVisibility={handleToggleVisibility}
            onToggleLock={handleToggleLock}
            onReorderLayer={handleReorderLayer}
            onDuplicateLayer={handleDuplicateLayer}
            onDeleteLayer={(id) => {
              recordHistory(shapes, dimensions);
              setShapes((prev) => prev.filter((s) => s.id !== id));
              setSelectedShapeIds((prev) => prev.filter((x) => x !== id));
            }}
            onRenameLayer={handleRenameLayer}
          />
        </aside>
      </div>

      {/* Drag & Drop Import Overlay */}
      <DropZoneOverlay
        isVisible={isDraggingFile}
        dimensions={dimensions}
        hasShapes={shapes.length > 0}
        onDropFile={handleFileSelected}
        onCancel={resetDragState}
      />

      {/* 3. Dialogs & Modals */}
      {/* New Project Dimensions Modal */}
      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        currentDimensions={dimensions}
        onCreate={(newDims) => {
          recordHistory(shapes, dimensions);
          setDimensions(newDims);
          setShapes([]);
          setSelectedShapeIds([]);
          setSelectedPointIds([]);
        }}
      />

      {/* Image Trace Modal (for raster PNG, JPG, WEBP) */}
      <ImageTraceModal
        isOpen={traceModalData.isOpen}
        imageSrc={traceModalData.imageSrc}
        filename={traceModalData.filename}
        isNewProject={traceModalData.isNewProject}
        onClose={() =>
          setTraceModalData((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={handleTraceConfirm}
      />

      {/* Export to Canva Frame Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        shapes={shapes}
        dimensions={dimensions}
        onFlattenFirst={handleFlattenShapes}
      />

      {/* Canva Guide Modal */}
      <CanvaGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <CanvaFrameApp />
    </ThemeProvider>
  );
}
