import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImportSizeCheckResult, VectorShape } from '../types';
import { pointsToSvgPath } from '../utils/bezier';
import { CANVA_MIN_IMPORT_SIZE, checkShapeImportSize } from '../utils/importSizeCheck';
import { useTheme } from '../context/ThemeContext';
import { CollapsibleSection } from './CollapsibleSection';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Layers as LayersIcon,
  AlertTriangle,
  Ruler,
  Settings,
} from 'lucide-react';

/**
 * The size-warning setting outlives the session: it is a preference about how
 * this frame is going to be used (one export per layer), not a property of the
 * artwork, so it does not belong in the project file or in undo history.
 */
const SIZE_WARNING_KEY = 'canva_frame_layer_size_warnings';

/** Off by default — see the note on the toggle for why. */
function readSizeWarningPref(): boolean {
  try {
    return localStorage.getItem(SIZE_WARNING_KEY) === 'on';
  } catch {
    return false;
  }
}

interface Props {
  shapes: VectorShape[];
  selectedShapeIds: string[];
  onSelectShape: (id: string, multi: boolean) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorderLayer: (id: string, direction: 'up' | 'down') => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onRenameLayer: (id: string, newName: string) => void;
}

export const LayersPanel: React.FC<Props> = ({
  shapes,
  selectedShapeIds,
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
  const [flagSmallLayers, setFlagSmallLayers] = useState(readSizeWarningPref);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Dismiss the settings popup the way every popup is dismissed: a click
  // anywhere outside it, or Escape.
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) setSettingsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_WARNING_KEY, flagSmallLayers ? 'on' : 'off');
    } catch {
      // A browser that refuses storage still gets the toggle, just not the memory.
    }
  }, [flagSmallLayers]);

  // Measured per layer rather than per selection: each entry answers "would
  // Canva take this shape if it were exported on its own?".
  const sizeChecks = useMemo(() => {
    if (!flagSmallLayers) return new Map<string, ImportSizeCheckResult>();
    return new Map(shapes.map((s) => [s.id, checkShapeImportSize(s)]));
  }, [shapes, flagSmallLayers]);

  const flaggedCount = useMemo(
    () =>
      [...sizeChecks.values()].filter(
        (c) => c.status === 'tooSmall' || c.status === 'tight'
      ).length,
    [sizeChecks]
  );

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
    <CollapsibleSection
      title={`Layers (${shapes.length})`}
      icon={<LayersIcon className="w-4 h-4 text-[#F43F5E]" />}
      badge={
        <span className="flex items-center gap-2">
          {/* Carried in the header so a collapsed panel still shows the count,
              where the per-layer icons are out of sight. */}
          {flaggedCount > 0 && (
            <span
              className="flex items-center gap-1 text-[11px] text-amber-500"
              title={`${flaggedCount} ${
                flaggedCount === 1 ? 'layer is' : 'layers are'
              } likely too small for Canva if exported separately`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {flaggedCount}
            </span>
          )}
          <span className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            {selectedShapeIds.length} selected
          </span>
        </span>
      }
      actions={
        <div ref={settingsRef} className="flex items-center">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
            title="Layer settings"
            className={`p-1 rounded transition-colors cursor-pointer ${
              settingsOpen
                ? 'text-[#F43F5E]'
                : isDark
                ? 'text-neutral-500 hover:text-neutral-200 hover:bg-[#2E2E2E]'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Hangs below the header, inset to the section's own padding: the
              right column clips horizontally, so a popup wider than 320px —
              or one anchored to the gear itself — would be cut off. */}
          {settingsOpen && (
            <div
              role="dialog"
              aria-label="Layer settings"
              className={`absolute top-full left-3 right-3 mt-1 z-30 rounded-lg border shadow-xl p-3 space-y-2 ${
                isDark
                  ? 'bg-[#1F1F1F] border-[#333] text-neutral-200'
                  : 'bg-white border-gray-200 text-gray-800'
              }`}
            >
              <div
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isDark ? 'text-neutral-500' : 'text-gray-400'
                }`}
              >
                Layer Settings
              </div>

              {/* Per-layer import-size warnings. Off by default: the normal
                  export combines every visible layer into one page, and under
                  that export a small layer is not a problem — the warning only
                  means something when each layer is exported as its own frame. */}
              <button
                type="button"
                onClick={() => setFlagSmallLayers((v) => !v)}
                aria-pressed={flagSmallLayers}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                  flagSmallLayers
                    ? 'bg-[#F43F5E]/10 border-[#F43F5E]/40 text-[#E11D48] dark:text-[#FB7185]'
                    : isDark
                    ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-400'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500'
                }`}
              >
                <Ruler className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left truncate">Warn on Small Layers</span>
                <span
                  className={`w-7 h-4 rounded-full shrink-0 flex items-center transition-colors ${
                    flagSmallLayers
                      ? 'bg-[#F43F5E]'
                      : isDark
                      ? 'bg-[#3A3A3A]'
                      : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      flagSmallLayers ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>

              <div
                className={`text-[10px] leading-relaxed ${
                  isDark ? 'text-neutral-500' : 'text-gray-500'
                }`}
              >
                Marks any layer whose own bounding box is under Canva’s{' '}
                {CANVA_MIN_IMPORT_SIZE} px minimum. The normal export combines every
                visible layer into one page, so this only matters when each layer is
                exported as its own frame.
                {flagSmallLayers && shapes.length > 0 && (
                  <>
                    {' '}
                    {flaggedCount > 0 ? (
                      <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>
                        {flaggedCount} of {shapes.length}{' '}
                        {flaggedCount === 1 ? 'layer is' : 'layers are'} flagged.
                      </span>
                    ) : (
                      <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                        Every layer clears it.
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      }
    >
      {/* Layers List. Capped so a long list scrolls inside its own block
          instead of pushing every other section off the column. */}
      <div className="max-h-72 overflow-y-auto space-y-1">
        {reversedShapes.length === 0 ? (
          <div className={`p-6 text-center text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
            No shape layers yet. Add a preset shape or use the Pen Tool.
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
    </CollapsibleSection>
  );
};
