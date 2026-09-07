import React, { useState } from 'react';
import { ImportSizeCheckResult, VectorShape } from '../types';
import { pointsToSvgPath } from '../utils/bezier';
import { useTheme } from '../context/ThemeContext';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Type,
} from 'lucide-react';

interface Props {
  shapes: VectorShape[];
  selectedShapeIds: string[];
  /**
   * Per-layer import-size verdicts, or an empty map while the warning is off.
   * Measured by `LayersSection`, which owns that setting because its toggle
   * lives in the section header rather than in this list.
   */
  sizeChecks: Map<string, ImportSizeCheckResult>;
  onSelectShape: (id: string, multi: boolean) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorderLayer: (id: string, direction: 'up' | 'down') => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onRenameLayer: (id: string, newName: string) => void;
}

/**
 * The layer list itself. The section chrome around it — the tab strip it shares
 * with Text, its settings gear and the counts in its header — is
 * `LayersSection`.
 */
export const LayersPanel: React.FC<Props> = ({
  shapes,
  selectedShapeIds,
  sizeChecks,
  onSelectShape,
  onToggleVisibility,
  onToggleLock,
  onReorderLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onRenameLayer,
}) => {
  const { isDark } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startRename = (shape: VectorShape) => {
    setEditingId(shape.id);
    setEditName(shape.name);
  };

  const commitRename = (id: string) => {
    if (editName.trim()) {
      onRenameLayer(id, editName.trim());
    }
    setEditingId(null);
  };

  // Layers displayed top-to-bottom in visual stack order (last item in shapes is top)
  const reversedShapes = [...shapes].reverse();

  return (
    <>
      {/* Layers List. Capped so a long list scrolls inside its own block
          instead of pushing every other section off the column. */}
      <div className="max-h-72 overflow-y-auto space-y-1">
        {reversedShapes.length === 0 ? (
          <div className={`p-6 text-center text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
            No shape layers yet. Add a preset shape, type with the Text tool
            (T), or use the Pen Tool.
          </div>
        ) : (
          reversedShapes.map((shape, revIdx) => {
            const isSelected = selectedShapeIds.includes(shape.id);
            const canMoveUp = revIdx > 0; // closer to top
            const canMoveDown = revIdx < reversedShapes.length - 1;

            const sizeCheck = sizeChecks.get(shape.id);
            const sizeWarning =
              sizeCheck &&
              (sizeCheck.status === 'tooSmall' || sizeCheck.status === 'tight')
                ? sizeCheck
                : null;

            return (
              <div
                key={shape.id}
                onClick={(e) => onSelectShape(shape.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? isDark
                      ? 'bg-[#F43F5E]/15 border-[#F43F5E]/50 text-white font-medium'
                      : 'bg-[#F43F5E]/15 border-[#F43F5E]/50 text-gray-900 font-medium'
                    : isDark
                    ? 'bg-[#242424] hover:bg-[#2A2A2A] border-transparent text-neutral-300'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-100 text-gray-700'
                }`}
              >
                {/* Mini SVG Thumbnail */}
                <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 overflow-hidden ${
                  isDark ? 'bg-[#121212] border-[#2A2A2A]' : 'bg-white border-gray-200'
                }`}>
                  <svg viewBox="0 0 100 100" className="w-5 h-5">
                    <path
                      d={pointsToSvgPath(shape.points, shape.closed)}
                      fill={shape.fillColor || '#F43F5E'}
                      stroke={shape.strokeColor || '#F43F5E'}
                      strokeWidth="10"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>

                {/* A layer still carrying live type says so. Its outlines look
                    like any other shape's, but only these can be retyped in
                    the Text tab — and only these lose that when they are
                    rotated, flipped or point-edited. */}
                {shape.text && (
                  <span
                    className="shrink-0 flex items-center text-[#F43F5E]"
                    title={`Editable text — ${shape.text.fontFamily} ${Math.round(
                      shape.text.fontSize
                    )}px. Select it and open the Text tab to change the wording or the face.`}
                  >
                    <Type className="w-3.5 h-3.5" />
                  </span>
                )}

                {/* Import-size warning. Sits before the name so it is never
                    pushed out of view by a long one. */}
                {sizeWarning && (
                  <span
                    className="shrink-0 flex items-center"
                    title={
                      sizeWarning.status === 'tooSmall'
                        ? `Too small for Canva — on its own this layer exports as a ${sizeWarning.width} × ${sizeWarning.height} px page, and its ${sizeWarning.smallestSide} px shortest side is under Canva’s ${sizeWarning.minimum} px minimum. Scale it about ${sizeWarning.suggestedScale}× (to roughly ${sizeWarning.suggestedWidth} × ${sizeWarning.suggestedHeight} px) before exporting it separately.`
                        : `Tight for Canva — on its own this layer exports as a ${sizeWarning.width} × ${sizeWarning.height} px page. It clears the ${sizeWarning.minimum} px minimum, but only just; about ${sizeWarning.suggestedWidth} × ${sizeWarning.suggestedHeight} px gives it room.`
                    }
                  >
                    <AlertTriangle
                      className={`w-3.5 h-3.5 ${
                        sizeWarning.status === 'tooSmall'
                          ? 'text-rose-500'
                          : 'text-amber-500'
                      }`}
                    />
                  </span>
                )}

                {/* Layer Name / Edit Input */}
                <div className="flex-1 min-w-0">
                  {editingId === shape.id ? (
                    <input
                      type="text"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => commitRename(shape.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(shape.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className={`w-full border rounded px-1.5 py-0.5 text-xs focus:outline-none ${
                        isDark ? 'bg-[#121212] border-[#F43F5E] text-white' : 'bg-white border-[#F43F5E] text-gray-900'
                      }`}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(shape);
                      }}
                      className="truncate text-xs select-none"
                      title="Double-click to rename"
                    >
                      {shape.name}
                    </div>
                  )}
                </div>

                {/* Layer Controls */}
                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                  {/* Reorder Buttons */}
                  <button
                    type="button"
                    disabled={!canMoveUp}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderLayer(shape.id, 'up');
                    }}
                    title="Move Layer Forward — Shift+) moves the selection"
                    aria-keyshortcuts="Shift+)"
                    className={`p-1 rounded disabled:opacity-20 transition-colors ${
                      isDark ? 'hover:bg-[#2E2E2E] text-neutral-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={!canMoveDown}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderLayer(shape.id, 'down');
                    }}
                    title="Move Layer Backward — Shift+( moves the selection"
                    aria-keyshortcuts="Shift+("
                    className={`p-1 rounded disabled:opacity-20 transition-colors ${
                      isDark ? 'hover:bg-[#2E2E2E] text-neutral-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Lock Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(shape.id);
                    }}
                    title={shape.locked ? 'Unlock Layer' : 'Lock Layer'}
                    className={`p-1 rounded transition-colors ${
                      isDark ? 'hover:bg-[#2E2E2E] text-neutral-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {shape.locked ? (
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                    )}
                  </button>

                  {/* Visibility Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(shape.id);
                    }}
                    title={shape.visible ? 'Hide Layer' : 'Show Layer'}
                    className={`p-1 rounded transition-colors ${
                      isDark ? 'hover:bg-[#2E2E2E] text-neutral-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {shape.visible ? (
                      <Eye className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`} />
                    ) : (
                      <EyeOff className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`} />
                    )}
                  </button>

                  {/* Duplicate */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateLayer(shape.id);
                    }}
                    title="Duplicate Layer"
                    className={`p-1 rounded hidden group-hover:inline-block transition-colors ${
                      isDark ? 'hover:bg-[#2E2E2E] text-neutral-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLayer(shape.id);
                    }}
                    title="Delete Layer"
                    className={`p-1 rounded transition-colors ${
                      isDark ? 'hover:bg-rose-950 text-neutral-400 hover:text-rose-400' : 'hover:bg-rose-100 text-gray-500 hover:text-rose-600'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};
