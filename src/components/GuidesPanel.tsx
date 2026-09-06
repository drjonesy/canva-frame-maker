import React from 'react';
import {
  Crosshair,
  Magnet,
  MoveHorizontal,
  MoveVertical,
  Ruler,
  Trash2,
  X,
} from 'lucide-react';
import { Guide, GuideAxis } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props {
  guides: Guide[];
  selectedGuideIds: string[];
  showRulers: boolean;
  showGuides: boolean;
  snapToGuides: boolean;
  onToggleRulers: () => void;
  onToggleGuides: () => void;
  onToggleSnap: () => void;
  onSelectGuide: (id: string, multi: boolean) => void;
  onUpdateGuide: (id: string, position: number) => void;
  onDeleteGuide: (id: string) => void;
  onAddCenterGuides: (axis: GuideAxis | 'both') => void;
  onClearGuides: () => void;
}

export const GuidesPanel: React.FC<Props> = ({
  guides,
  selectedGuideIds,
  showRulers,
  showGuides,
  snapToGuides,
  onToggleRulers,
  onToggleGuides,
  onToggleSnap,
  onSelectGuide,
  onUpdateGuide,
  onDeleteGuide,
  onAddCenterGuides,
  onClearGuides,
}) => {
  const { isDark } = useTheme();

  const toggleClass = (on: boolean) =>
    `flex flex-col items-center gap-1 px-1 py-2 rounded-lg border text-[10px] font-medium transition-colors ${
      on
        ? 'bg-[#F43F5E]/10 border-[#F43F5E]/40 text-[#E11D48] dark:text-[#FB7185]'
        : isDark
        ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-400'
        : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500'
    }`;

  const actionClass = `flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] transition-colors ${
    isDark
      ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-200'
      : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
  }`;

  const muted = isDark ? 'text-neutral-400' : 'text-gray-500';

  return (
    <div className="space-y-3">
      {/* Visibility & snapping */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={onToggleRulers}
          title="Show rulers (R)"
          aria-pressed={showRulers}
          className={toggleClass(showRulers)}
        >
          <Ruler className="w-4 h-4" />
          Rulers
        </button>
        <button
          type="button"
          onClick={onToggleGuides}
          title="Show guides (G)"
          aria-pressed={showGuides}
          className={toggleClass(showGuides)}
        >
          <Crosshair className="w-4 h-4" />
          Guides
        </button>
        <button
          type="button"
          onClick={onToggleSnap}
          title="Snap dragged shapes to guides"
          aria-pressed={snapToGuides}
          className={toggleClass(snapToGuides)}
        >
          <Magnet className="w-4 h-4" />
          Snap
        </button>
      </div>

      <p className={`text-[10px] leading-relaxed ${muted}`}>
        Drag from a ruler onto the canvas to place a guide. Drag a guide back
        onto its ruler to remove it.
      </p>

      {/* Centre guides */}
      <div>
        <div
          className={`text-[10px] uppercase tracking-wider mb-1.5 font-semibold ${muted}`}
        >
          Canvas centre
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onAddCenterGuides('x')}
            title="Add a vertical guide down the centre of the canvas"
            className={actionClass}
          >
            <MoveVertical className="w-3.5 h-3.5 text-[#06B6D4]" />
            Vert
          </button>
          <button
            type="button"
            onClick={() => onAddCenterGuides('y')}
            title="Add a horizontal guide across the centre of the canvas"
            className={actionClass}
          >
            <MoveHorizontal className="w-3.5 h-3.5 text-[#06B6D4]" />
            Horz
          </button>
          <button
            type="button"
            onClick={() => onAddCenterGuides('both')}
            title="Add both centre guides"
            className={actionClass}
          >
            <Crosshair className="w-3.5 h-3.5 text-[#F43F5E]" />
            Both
          </button>
        </div>
      </div>

      {/* Guide list */}
      {guides.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[10px] uppercase tracking-wider font-semibold ${muted}`}
            >
              Guides
            </span>
            <button
              type="button"
              onClick={onClearGuides}
              className={`flex items-center gap-1 text-[10px] transition-colors ${
                isDark
                  ? 'text-neutral-500 hover:text-[#FB7185]'
                  : 'text-gray-400 hover:text-[#E11D48]'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              Clear all
            </button>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
            {guides.map((g) => {
              const picked = selectedGuideIds.includes(g.id);
              return (
                <div
                  key={g.id}
                  onClick={(e) => onSelectGuide(g.id, e.shiftKey)}
                  className={`flex items-center gap-2 px-2 py-1 rounded border cursor-pointer transition-colors ${
                    picked
                      ? 'bg-[#F43F5E]/10 border-[#F43F5E]/40'
                      : isDark
                      ? 'bg-[#141414] border-[#2A2A2A] hover:bg-[#242424]'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {g.axis === 'x' ? (
                    <MoveVertical className="w-3.5 h-3.5 shrink-0 text-[#06B6D4]" />
                  ) : (
                    <MoveHorizontal className="w-3.5 h-3.5 shrink-0 text-[#06B6D4]" />
                  )}
                  <span className={`text-[10px] font-mono w-3 shrink-0 ${muted}`}>
                    {g.axis === 'x' ? 'X' : 'Y'}
                  </span>
                  <input
                    type="number"
                    value={Math.round(g.position)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (Number.isFinite(next)) onUpdateGuide(g.id, next);
                    }}
                    className={`flex-1 min-w-0 bg-transparent font-mono text-[11px] px-1 py-0.5 rounded outline-none border border-transparent focus:border-[#F43F5E]/50 ${
                      isDark ? 'text-neutral-200' : 'text-gray-800'
                    }`}
                  />
                  <button
                    type="button"
                    title="Delete guide"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGuide(g.id);
                    }}
                    className={`p-0.5 rounded shrink-0 transition-colors ${
                      isDark
                        ? 'text-neutral-500 hover:text-[#FB7185]'
                        : 'text-gray-400 hover:text-[#E11D48]'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className={`text-[10px] leading-relaxed ${muted}`}>
        Aligning the selection to a guide lives on the Align tab.
      </p>
    </div>
  );
};
