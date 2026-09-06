import React from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  ROTATE_MAX_STEP,
  ROTATE_MIN_STEP,
  ROTATE_SNAP_DEG,
  RotateOrigin,
} from '../utils/rotate';

interface Props {
  /** How many shapes the rotation would act on. */
  selectedCount: number;
  /** The custom angle as typed — a string so the field can be cleared. */
  angleText: string;
  angle: number;
  origin: RotateOrigin;
  onAngleTextChange: (text: string) => void;
  onOriginChange: (origin: RotateOrigin) => void;
  /** Turn the selection by this many degrees; positive is clockwise. */
  onRotate: (deltaDeg: number) => void;
}

const PRESETS = [15, 30, 45, 90];

/** Rotate the selection. A tab body of the right column. */
export const RotatePanel: React.FC<Props> = ({
  selectedCount,
  angleText,
  angle,
  origin,
  onAngleTextChange,
  onOriginChange,
  onRotate,
}) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-neutral-400' : 'text-gray-500';
  const canRotate = selectedCount > 0;

  const label = `text-[10px] uppercase tracking-wider mb-1.5 font-semibold ${muted}`;

  const actionClass = `flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
    canRotate
      ? `cursor-pointer ${
          isDark
            ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-200'
            : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
        }`
      : `opacity-40 cursor-default ${
          isDark
            ? 'bg-[#242424] border-[#2A2A2A] text-neutral-400'
            : 'bg-gray-50 border-gray-200 text-gray-500'
        }`
  }`;

  const presetClass = (on: boolean) =>
    `px-1 py-1 rounded-md border text-[10px] font-mono transition-colors cursor-pointer ${
      on
        ? 'bg-[#F43F5E]/10 border-[#F43F5E]/40 text-[#E11D48] dark:text-[#FB7185]'
        : isDark
        ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-400'
        : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500'
    }`;

  const originClass = (on: boolean) =>
    `flex-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
      on
        ? isDark
          ? 'bg-[#2E2E2E] text-white shadow-sm'
          : 'bg-white text-gray-900 shadow-sm'
        : isDark
        ? 'text-neutral-500 hover:text-neutral-300'
        : 'text-gray-500 hover:text-gray-800'
    }`;

  // `aria-disabled` rather than `disabled` throughout, matching the rail: the
  // buttons stay in the tab order and keep explaining themselves when there is
  // nothing selected.
  const rotateBy = (delta: number) => {
    if (canRotate) onRotate(delta);
  };

  return (
    <div className="space-y-3">
      {/* Quarter and half turns, the angles that need no typing */}
      <div>
        <div className={label}>Quick turns</div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            aria-disabled={!canRotate || undefined}
            onClick={() => rotateBy(-90)}
            title="Rotate 90° counter-clockwise"
            className={actionClass}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            90°
          </button>
          <button
            type="button"
            aria-disabled={!canRotate || undefined}
            onClick={() => rotateBy(90)}
            title="Rotate 90° clockwise"
            className={actionClass}
          >
            <RotateCw className="w-3.5 h-3.5" />
            90°
          </button>
          <button
            type="button"
            aria-disabled={!canRotate || undefined}
            onClick={() => rotateBy(180)}
            title="Turn upside down"
            className={actionClass}
          >
            180°
          </button>
        </div>
      </div>

      {/* Any other angle, applied in either direction */}
      <div>
        <div className={label}>By angle</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={ROTATE_MIN_STEP}
            max={ROTATE_MAX_STEP}
            step={1}
            value={angleText}
            onChange={(e) => onAngleTextChange(e.target.value)}
            aria-label="Rotation angle in degrees"
            className={`w-16 font-mono text-xs px-2 py-1.5 rounded-lg border outline-none transition-colors focus:border-[#F43F5E]/50 ${
              isDark
                ? 'bg-[#141414] border-[#2A2A2A] text-neutral-200'
                : 'bg-gray-50 border-gray-200 text-gray-800'
            }`}
          />
          <button
            type="button"
            aria-disabled={!canRotate || undefined}
            onClick={() => rotateBy(-angle)}
            aria-label={`Rotate ${angle} degrees counter-clockwise`}
            className={`${actionClass} flex-1`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-disabled={!canRotate || undefined}
            onClick={() => rotateBy(angle)}
            aria-label={`Rotate ${angle} degrees clockwise`}
            className={`${actionClass} flex-1`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 mt-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onAngleTextChange(String(p))}
              className={presetClass(angle === p)}
            >
              {p}°
            </button>
          ))}
        </div>
      </div>

      {/* Pivot. Only tells two things apart once several shapes are selected. */}
      <div>
        <div className={label}>Pivot</div>
        <div
          className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${
            isDark ? 'bg-[#141414] border-[#2A2A2A]' : 'bg-gray-100 border-gray-200'
          }`}
        >
          <button
            type="button"
            onClick={() => onOriginChange('selection')}
            aria-pressed={origin === 'selection'}
            className={originClass(origin === 'selection')}
          >
            Selection
          </button>
          <button
            type="button"
            onClick={() => onOriginChange('each')}
            aria-pressed={origin === 'each'}
            className={originClass(origin === 'each')}
          >
            Each object
          </button>
        </div>
      </div>

      <p className={`text-[10px] leading-relaxed ${muted}`}>
        {!canRotate
          ? 'Select a shape to rotate it. '
          : origin === 'each'
          ? `Each of the ${selectedCount} selected shape${
              selectedCount > 1 ? 's turns' : ' turns'
            } about its own centre. `
          : selectedCount > 1
          ? `The ${selectedCount} selected shapes turn together about the centre of the selection. `
          : 'The shape turns about the centre of its bounding box. '}
        On the canvas, drag the handle above the selection box to rotate freely;
        hold Shift to snap to {ROTATE_SNAP_DEG}°.
      </p>
    </div>
  );
};
