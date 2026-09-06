import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  CanvasDimensions,
  PathPoint,
  Point2D,
  ToolMode,
  VectorShape,
} from '../types';
import {
  getShapeBounds,
  pointsToSvgPath,
  shapeToSvgPath,
} from '../utils/bezier';

interface Props {
  dimensions: CanvasDimensions;
  shapes: VectorShape[];
  selectedShapeIds: string[];
  selectedPointIds: string[];
  currentTool: ToolMode;
  zoom: number;
  onSelectShape: (id: string, multi: boolean) => void;
  onClearSelection: () => void;
  onSelectPoint: (id: string, multi: boolean) => void;
  onUpdateShapes: (updated: VectorShape[]) => void;
  onUpdateActivePoints: (updatedPoints: PathPoint[], isClosed?: boolean) => void;
  onFinishPath: () => void;
}

export const CanvasArea: React.FC<Props> = ({
  dimensions,
  shapes,
  selectedShapeIds,
  selectedPointIds,
  currentTool,
  zoom,
  onSelectShape,
  onClearSelection,
  onSelectPoint,
  onUpdateShapes,
  onUpdateActivePoints,
  onFinishPath,
}) => {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  // Mouse drag interaction states
  const [dragTarget, setDragTarget] = useState<{
    type: 'shape' | 'point' | 'handle1' | 'handle2' | 'resize';
    shapeId: string;
    pointId?: string;
    handleType?: 'cp1' | 'cp2';
    resizeDir?: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
    startX: number;
    startY: number;
    initialShapes: VectorShape[];
    initialPoints?: PathPoint[];
    initialBounds?: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  } | null>(null);

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
          strokeWidth: 2,
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

    if (!dragTarget) return;

    const dx = canvasPos.x - dragTarget.startX;
    const dy = canvasPos.y - dragTarget.startY;

    // 1. Dragging an entire Shape (Move)
    if (dragTarget.type === 'shape') {
      const updated = dragTarget.initialShapes.map((s) => {
        if (!selectedShapeIds.includes(s.id)) return s;
        return {
          ...s,
          points: s.points.map((p) => ({
            ...p,
            x: p.x + dx,
            y: p.y + dy,
            cp1: p.cp1 ? { x: p.cp1.x + dx, y: p.cp1.y + dy } : undefined,
            cp2: p.cp2 ? { x: p.cp2.x + dx, y: p.cp2.y + dy } : undefined,
          })),
          subPaths: s.subPaths?.map((sub) =>
            sub.map((p) => ({
              ...p,
              x: p.x + dx,
              y: p.y + dy,
              cp1: p.cp1 ? { x: p.cp1.x + dx, y: p.cp1.y + dy } : undefined,
              cp2: p.cp2 ? { x: p.cp2.x + dx, y: p.cp2.y + dy } : undefined,
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
      let newMinX = b.minX;
      let newMaxX = b.maxX;
      let newMinY = b.minY;
      let newMaxY = b.maxY;

      const dir = dragTarget.resizeDir || 'se';
      if (dir.includes('e')) newMaxX = Math.max(b.minX + 10, b.maxX + dx);
      if (dir.includes('w')) newMinX = Math.min(b.maxX - 10, b.minX + dx);
      if (dir.includes('s')) newMaxY = Math.max(b.minY + 10, b.maxY + dy);
      if (dir.includes('n')) newMinY = Math.min(b.maxY - 10, b.minY + dy);

      const scaleX = (newMaxX - newMinX) / b.width;
      const scaleY = (newMaxY - newMinY) / b.height;

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

  const handleMouseUp = () => {
    setIsPanning(false);
    setDragTarget(null);
  };

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

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`flex-1 relative overflow-hidden select-none transition-colors ${
        isDark ? 'bg-[#121212]' : 'bg-[#F3F4F6]'
      } ${
        spacePressed || currentTool === 'pan'
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
        className="absolute transition-transform duration-75 origin-center"
        style={{
          left: '50%',
          top: '50%',
          width: dimensions.width,
          height: dimensions.height,
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          boxShadow: isDark
            ? '0 25px 70px -10px rgba(0, 0, 0, 0.95), 0 0 0 1px #2A2A2A'
            : '0 20px 50px -10px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Canvas Background Checkered Pattern */}
        <div
          className="absolute inset-0 bg-white"
          style={{
            backgroundImage: isDark
              ? 'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)'
              : 'linear-gradient(45deg, #f9fafb 25%, transparent 25%), linear-gradient(-45deg, #f9fafb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f9fafb 75%), linear-gradient(-45deg, transparent 75%, #f9fafb 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        />

        {/* Blank Canvas Watermark / Hint when no shapes */}
        {shapes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none p-6 text-center">
            <div className={`text-sm font-semibold tracking-tight mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              Blank Canva Frame Canvas
            </div>
            <div className={`text-xs max-w-xs ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
              Select the Pen Tool (P) or choose a Preset Shape from the toolbar to start creating your frame
            </div>
          </div>
        )}

        {/* SVG Drawing Canvas */}
        <svg
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="absolute inset-0 w-full h-full overflow-visible"
        >
          {/* Render Vector Shapes */}
          {shapes.map((shape) => {
            if (!shape.visible) return null;
            const isSelected = selectedShapeIds.includes(shape.id);

            return (
              <path
                key={shape.id}
                d={shapeToSvgPath(shape)}
                fill={shape.fillColor || '#F43F5E'}
                stroke={isSelected ? '#F43F5E' : shape.strokeColor || '#1A1A1A'}
                strokeWidth={
                  isSelected
                    ? Math.max(shape.strokeWidth, 2)
                    : shape.strokeWidth
                }
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
                             r={4.5 / zoom}
                             fill="#FF5722"
                             stroke="#121212"
                             strokeWidth={1.5 / zoom}
                             className="cursor-move hover:scale-125 transition-transform"
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
                             r={4.5 / zoom}
                             fill="#FF5722"
                             stroke="#121212"
                             strokeWidth={1.5 / zoom}
                             className="cursor-move hover:scale-125 transition-transform"
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

                       {/* Anchor Dot */}
                       <circle
                         cx={pt.x}
                         cy={pt.y}
                         r={(isPointSelected ? 6.5 : 5) / zoom}
                         fill={isPointSelected ? '#F43F5E' : '#ffffff'}
                         stroke={isFirst && isNearFirstPoint ? '#FF5722' : '#F43F5E'}
                         strokeWidth={(isPointSelected ? 2.5 : 2) / zoom}
                         className="cursor-pointer hover:scale-125 transition-transform"
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
                       />
                     </g>
                   );
                 })}
               </g>
             )}

          {/* Select Mode Bounding Box & 8 Resize Handles */}
          {activeBounds && currentTool === 'select' && (
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
                  className="pointer-events-auto cursor-nwse-resize"
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
        </svg>
      </div>

      {/* Floating Canvas Meta Pill */}
      <div className={`absolute bottom-3 left-3 z-20 flex items-center gap-2 backdrop-blur-md px-3 py-1 rounded border text-[10px] font-mono transition-colors shadow-lg ${
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
