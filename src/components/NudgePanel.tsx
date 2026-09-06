import React from 'react';
import { Lock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  NUDGE_MAX_STEP,
  NUDGE_MIN_STEP,
  NUDGE_SHIFT_MULTIPLIER,
} from '../utils/nudge';

interface Props {
  /** The step in canvas units, as typed — kept as a string so the field can be
      cleared or hold "0." while the user is still typing. */
  stepText: string;
  step: number;
  /** What the arrow keys would move right now, for the panel's own note. */
  target: 'shapes' | 'points' | 'guides' | null;
  onStepTextChange: (text: string) => void;
  /** Lock Move (L): a Select-tool drag is held to one axis. */
  lockMove: boolean;
  onToggleLockMove: () => void;
}

const PRESETS = [1, 5, 10, 50];

/**
 * Moving the selection: the step the arrow keys nudge by, and the axis lock a
 * mouse drag obeys. A tab body of the right column.
 */
export const NudgePanel: React.FC<Props> = ({
  stepText,
  step,
  target,
  onStepTextChange,
  lockMove,
  onToggleLockMove,
}) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-neutral-400' : 'text-gray-500';

  const presetClass = (on: boolean) =>
    `px-1 py-1 rounded-md border text-[10px] font-mono transition-colors cursor-pointer ${
      on
        ? 'bg-[#F43F5E]/10 border-[#F43F5E]/40 text-[#E11D48] dark:text-[#FB7185]'
        : isDark
        ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-400'
        : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500'
    }`;

  const targetNote =
    target === 'points'
      ? 'Moving the selected points.'
      : target === 'guides'
      ? 'Moving the selected guide.'
      : target === 'shapes'
      ? 'Moving the selected shapes.'
      : 'Select a shape, point or guide to move it.';

  return (
    <div className="space-y-3">
      {/* Step size */}
      <div>
        <div
          className={`text-[10px] uppercase tracking-wider mb-1.5 font-semibold ${muted}`}
        >
          Step size
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={NUDGE_MIN_STEP}
            max={NUDGE_MAX_STEP}
            step={1}
            value={stepText}
            onChange={(e) => onStepTextChange(e.target.value)}
            aria-label="Nudge step size in canvas units"
            className={`w-20 font-mono text-xs px-2 py-1.5 rounded-lg border outline-none transition-colors focus:border-[#F43F5E]/50 ${
              isDark
                ? 'bg-[#141414] border-[#2A2A2A] text-neutral-200'
                : 'bg-gray-50 border-gray-200 text-gray-800'
            }`}
          />
          <div className="flex-1 grid grid-cols-4 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onStepTextChange(String(p))}
                className={presetClass(step === p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className={`text-[10px] leading-relaxed ${muted}`}>
        Arrow keys move the selection by the step above; hold Shift to move{' '}
        {NUDGE_SHIFT_MULTIPLIER}× as far. {targetNote}
      </p>

      {/* Axis lock, for dragging rather than nudging */}
      <div>
        <div
          className={`text-[10px] uppercase tracking-wider mb-1.5 font-semibold ${muted}`}
        >
          Dragging
        </div>
        <button
          type="button"
          onClick={onToggleLockMove}
          title="Lock a drag to one axis (L)"
          aria-keyshortcuts="L"
          aria-pressed={lockMove}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
            lockMove
              ? 'bg-[#F43F5E]/10 border-[#F43F5E]/40 text-[#E11D48] dark:text-[#FB7185]'
              : isDark
              ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-400'
              : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500'
          }`}
        >
          <Lock className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">Lock Move</span>
          <span className="font-mono text-[10px] opacity-70">
            {lockMove ? 'On · L' : 'Off · L'}
          </span>
        </button>
      </div>

      <p className={`text-[10px] leading-relaxed ${muted}`}>
        With Lock Move on, dragging a selection with the Select tool keeps it
        straight — horizontal or vertical, whichever way the drag is heading.
      </p>
    </div>
  );
};
