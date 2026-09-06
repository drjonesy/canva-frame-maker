import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BooleanOperation,
  CanvasDimensions,
  PathPoint,
  PointAlignType,
  ShapePresetType,
  ToolMode,
  VectorShape,
} from './types';
import {
  alignPoints,
  alignShapes,
  ObjectAlignType,
} from './utils/alignment';
import {
  unbreakHandles,
  updatePointType,
} from './utils/bezier';
import {
  flattenAllShapes,
  groupShapesIntoCompound,
  performBooleanOperation,
} from './utils/booleanOps';
import { detectOverlays } from './utils/overlayDetector';
import { createPresetShape } from './utils/shapePresets';
import { parseSvgToVectorShapes } from './utils/vectorTrace';

import { CanvasArea } from './components/CanvasArea';
import { CanvaGuideModal } from './components/CanvaGuideModal';
import { ExportModal } from './components/ExportModal';
import { ImageTraceModal } from './components/ImageTraceModal';
import { LayersPanel } from './components/LayersPanel';
import { NewProjectModal } from './components/NewProjectModal';
import { PenInspector } from './components/PenInspector';
import { PropertiesPanel } from './components/PropertiesPanel';
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

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, V, A, P, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'v') {
        setCurrentTool('select');
      } else if (e.key.toLowerCase() === 'a') {
        setCurrentTool('directSelect');
      } else if (e.key.toLowerCase() === 'p') {
        setCurrentTool('pen');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPointIds.length > 0) {
          handleDeleteSelectedPoints();
        } else if (selectedShapeIds.length > 0) {
          handleDeleteSelectedShapes();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedPointIds, selectedShapeIds]);

  // Selected shapes references
  const selectedShapes = useMemo(() => {
    return shapes.filter((s) => selectedShapeIds.includes(s.id));
  }, [shapes, selectedShapeIds]);

  const activeShape = selectedShapes[0] || null;

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
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const { shapes: parsedShapes, width, height } =
            parseSvgToVectorShapes(text);

          if (parsedShapes.length === 0) {
            alert('No vector shapes found in SVG.');
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

  // --- Align Objects ---
  const handleAlignObjects = (type: ObjectAlignType) => {
    if (selectedShapeIds.length < 2) return;
    recordHistory(shapes, dimensions);
    const aligned = alignShapes(shapes, selectedShapeIds, type);
    setShapes(aligned);
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

    const dupId = `shape_${Date.now()}`;
    const dup: VectorShape = {
      ...target,
      id: dupId,
      name: `${target.name} Copy`,
      points: target.points.map((p) => ({
        ...p,
        id: `${dupId}_${p.id}`,
        x: p.x + 25,
        y: p.y + 25,
        cp1: p.cp1 ? { x: p.cp1.x + 25, y: p.cp1.y + 25 } : undefined,
        cp2: p.cp2 ? { x: p.cp2.x + 25, y: p.cp2.y + 25 } : undefined,
      })),
    };

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
    <div className="flex flex-col h-screen w-screen bg-[#F3F4F6] dark:bg-[#121212] text-gray-900 dark:text-neutral-100 overflow-hidden font-sans">
      {/* 1. Top Header Toolbar */}
      <Toolbar
        currentTool={currentTool}
        onSelectTool={(tool) => {
          setCurrentTool(tool);
          if (tool === 'select') setSelectedPointIds([]);
        }}
        onAddPresetShape={handleAddPresetShape}
        onNewProject={() => setIsNewModalOpen(true)}
        onFileSelected={handleFileSelected}
        onExport={() => setIsExportModalOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        zoom={zoom}
        onZoomChange={setZoom}
        onFitToScreen={() => {
          setZoom(0.65);
        }}
        hasOverlays={overlayStatus.hasOverlay}
        onOpenGuide={() => setIsGuideModalOpen(true)}
      />

      {/* 2. Main Studio Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Interactive Canvas Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <CanvasArea
            dimensions={dimensions}
            shapes={shapes}
            selectedShapeIds={selectedShapeIds}
            selectedPointIds={selectedPointIds}
            currentTool={currentTool}
            zoom={zoom}
            onSelectShape={(id, multi) => {
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
            }}
            onSelectPoint={(id, multi) => {
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
          />

          {/* Floating Pen & Sub-Select Inspector (Bottom-Center) */}
          {(currentTool === 'pen' || currentTool === 'directSelect') && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <PenInspector
                selectedPoint={selectedPoint}
                selectedPointIds={selectedPointIds}
                totalPointsInPath={activeShape?.points.length || 0}
                isClosed={activeShape?.closed || false}
                onUpdatePointType={handleUpdatePointType}
                onUnbreakHandles={handleUnbreakHandles}
                onAlignPoints={handleAlignPoints}
                onDeletePoint={handleDeleteSelectedPoints}
                onToggleClosePath={handleToggleClosePath}
                onUpdatePointCoords={handleUpdatePointCoords}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar: Properties & Layers Panels */}
        <div className="flex divide-x divide-gray-200 dark:divide-[#2A2A2A] h-full">
          <LayersPanel
            shapes={shapes}
            selectedShapeIds={selectedShapeIds}
            onSelectShape={(id, multi) => {
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

          <PropertiesPanel
            dimensions={dimensions}
            onUpdateDimensions={handleUpdateDimensions}
            selectedShapes={selectedShapes}
            onAlignObjects={handleAlignObjects}
            onBooleanOperation={handleBooleanOperation}
            onGroupShapes={handleGroupShapes}
            onFlattenShapes={handleFlattenShapes}
            onUpdateShapeStyle={handleUpdateShapeStyle}
          />
        </div>
      </div>

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
