import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImportSizeCheckResult, VectorShape } from '../types';
import { CANVA_MIN_IMPORT_SIZE, checkShapeImportSize } from '../utils/importSizeCheck';
import { useTheme } from '../context/ThemeContext';
import { LayersPanel } from './LayersPanel';
import { TabbedSection } from './TabbedSection';
import {
  AlertTriangle,
  Layers as LayersIcon,
  Ruler,
  Settings,
  Type,
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
  /** The Text tab's body, built by App from the current selection. */
  fontsTab: React.ReactNode;
  /** Shown beside the Text tab label while a text layer is selected. */
  fontsBadge?: React.ReactNode;
  onSelectShape: (id: string, multi: boolean) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorderLayer: (id: string, direction: 'up' | 'down') => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onRenameLayer: (id: string, newName: string) => void;
}

/**
 * The bottom block of the right column: **Layers | Text**.
 *
 * The two share a tab strip because they answer the same question from
 * opposite ends — Layers is every object in the frame, Text is the one
 * selected object that is still type — and because the column has no room to
 * stack a second full-height list below the first.
 *
 * The layer size-warning preference lives here rather than in `LayersPanel`
 * because its gear sits in the section header while the triangles it switches
 * on are down in the list, so neither half owns it alone.
 */
export const LayersSection: React.FC<Props> = ({
  shapes,
  selectedShapeIds,
  fontsTab,
  fontsBadge,
  onSelectShape,
  onToggleVisibility,
  onToggleLock,
  onReorderLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onRenameLayer,
}) => {
  const { isDark } = useTheme();
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

  return (
    <TabbedSection
      tabs={[
        {
          id: 'layers',
          label: `Layers (${shapes.length})`,
          icon: <LayersIcon className="w-3.5 h-3.5" />,
          badge: (
            <span className="flex items-center gap-2">
              {/* Carried in the header so a collapsed panel still shows the
                  count, where the per-layer icons are out of sight. */}
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
              <span
                className={`text-[11px] ${
                  isDark ? 'text-neutral-400' : 'text-gray-500'
                }`}
              >
                {selectedShapeIds.length} selected
              </span>
            </span>
          ),
          actions: (
            <div ref={settingsRef} className="flex items-center">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                aria-expanded={settingsOpen}
                aria-haspopup="dialog"
                title="Layer settings"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  settingsOpen
                    ? 'text-[#F43F5E]'
                    : isDark
                    ? 'text-neutral-500 hover:text-neutral-200 hover:bg-[#242424]'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Hangs below the header, inset to the section's own padding:
                  the right column clips horizontally, so a popup wider than
                  320px — or one anchored to the gear itself — would be cut
                  off. */}
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
                      export combines every visible layer into one page, and
                      under that export a small layer is not a problem — the
                      warning only means something when each layer is exported
                      as its own frame. */}
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
                    <span className="flex-1 text-left truncate">
                      Warn on Small Layers
                    </span>
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
                    {CANVA_MIN_IMPORT_SIZE} px minimum. The normal export
                    combines every visible layer into one page, so this only
                    matters when each layer is exported as its own frame.
                    {flagSmallLayers && shapes.length > 0 && (
                      <>
                        {' '}
                        {flaggedCount > 0 ? (
                          <span
                            className={isDark ? 'text-amber-400' : 'text-amber-600'}
                          >
                            {flaggedCount} of {shapes.length}{' '}
                            {flaggedCount === 1 ? 'layer is' : 'layers are'}{' '}
                            flagged.
                          </span>
                        ) : (
                          <span
                            className={
                              isDark ? 'text-emerald-400' : 'text-emerald-600'
                            }
                          >
                            Every layer clears it.
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ),
          content: (
            <LayersPanel
              shapes={shapes}
              selectedShapeIds={selectedShapeIds}
              sizeChecks={sizeChecks}
              onSelectShape={onSelectShape}
              onToggleVisibility={onToggleVisibility}
              onToggleLock={onToggleLock}
              onReorderLayer={onReorderLayer}
              onDuplicateLayer={onDuplicateLayer}
              onDeleteLayer={onDeleteLayer}
              onRenameLayer={onRenameLayer}
            />
          ),
        },
        {
          id: 'fonts',
          label: 'Text',
          icon: <Type className="w-3.5 h-3.5" />,
          badge: fontsBadge,
          content: fontsTab,
        },
      ]}
    />
  );
};
