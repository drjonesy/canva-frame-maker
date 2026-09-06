import React from 'react';
import { PathPoint, PointAlignType } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  CornerDownRight,
  CircleDot,
  Split,
  RefreshCw,
  Trash2,
  Lock,
  Unlock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
} from 'lucide-react';

interface Props {
  selectedPoint: PathPoint | null;
  selectedPointIds: string[];
  totalPointsInPath: number;
  isClosed: boolean;
  onUpdatePointType: (type: 'straight' | 'rounded' | 'break') => void;
  onUnbreakHandles: () => void;
  onAlignPoints: (alignType: PointAlignType) => void;
  onDeletePoint: () => void;
  onToggleClosePath: () => void;
  onUpdatePointCoords: (x: number, y: number) => void;
}

export const PenInspector: React.FC<Props> = ({
  selectedPoint,
  selectedPointIds,
  totalPointsInPath,
  isClosed,
  onUpdatePointType,
  onUnbreakHandles,
  onAlignPoints,
  onDeletePoint,
  onToggleClosePath,
  onUpdatePointCoords,
}) => {
  const { isDark } = useTheme();

  if (!selectedPoint && selectedPointIds.length === 0) {
    return (
      <div className={`px-4 py-2 backdrop-blur-md border rounded-md shadow-2xl flex items-center gap-3 text-xs font-mono transition-colors ${
        isDark ? 'bg-[#1A1A1A]/95 border-[#2A2A2A] text-neutral-400' : 'bg-white/95 border-gray-200 text-gray-600'
      }`}>
        <CircleDot className="w-4 h-4 text-[#F43F5E]" />
        <span>Click or drag on the canvas to add anchor points & Bézier curves</span>
      </div>
    );
  }

  const multiSelect = selectedPointIds.length > 1;

  return (
    <div className={`px-3.5 py-2 backdrop-blur-md border rounded-md shadow-2xl flex items-center gap-3 text-xs transition-colors ${
      isDark ? 'bg-[#1A1A1A]/95 border-[#2A2A2A] text-neutral-200' : 'bg-white/95 border-gray-200 text-gray-800'
    }`}>
      {/* Selection info */}
      <div className={`flex items-center gap-1.5 pr-2 border-r font-mono text-[11px] ${
        isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
      }`}>
        <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {multiSelect
            ? `${selectedPointIds.length} Dots Selected`
            : `Point (${Math.round(selectedPoint?.x || 0)}, ${Math.round(
                selectedPoint?.y || 0
              )})`}
        </span>
      </div>

      {/* Point Type Switcher (Single Point) */}
      {!multiSelect && selectedPoint && (
        <div className={`flex items-center gap-1 pr-2 border-r ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}>
          <span className={`text-[10px] font-mono uppercase mr-1 ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}>Style:</span>

          {/* Straight */}
          <button
            type="button"
            onClick={() => onUpdatePointType('straight')}
            title="Straight (Sharp corner without handles)"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              selectedPoint.type === 'straight'
                ? 'bg-gradient-to-r from-[#F43F5E] to-[#FF5722] text-white font-semibold shadow-xs'
                : isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 border border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
            }`}
          >
            <CornerDownRight className="w-3.5 h-3.5" />
            Straight
          </button>

          {/* Rounded / Smooth */}
          <button
            type="button"
            onClick={() => onUpdatePointType('rounded')}
            title="Rounded (Smooth continuous curve with mirrored handles)"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              selectedPoint.type === 'rounded'
                ? 'bg-gradient-to-r from-[#F43F5E] to-[#FF5722] text-white font-semibold shadow-xs'
                : isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 border border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5" />
            Rounded
          </button>

          {/* Break Handles */}
          <button
            type="button"
            onClick={() => onUpdatePointType('break')}
            title="Break Handles (Manipulate each handlebar independently)"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              selectedPoint.type === 'break'
                ? 'bg-gradient-to-r from-[#F43F5E] to-[#FF5722] text-white font-semibold shadow-xs'
                : isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 border border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            Break Handles
          </button>
        </div>
      )}

      {/* Handlebar Operations */}
      {!multiSelect && selectedPoint && selectedPoint.type !== 'straight' && (
        <div className={`flex items-center gap-1.5 pr-2 border-r ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}>
          <button
            type="button"
            onClick={onUnbreakHandles}
            title="Unbreak / Re-align handles symmetrically"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors border ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 hover:text-white border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border-gray-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#FF5722]" />
            Unbreak Handles
          </button>
        </div>
      )}

      {/* Align Dots (When multiple points selected) */}
      {multiSelect && (
        <div className={`flex items-center gap-1 pr-2 border-r ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}>
          <span className={`text-[10px] font-mono uppercase mr-1 ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}>Align:</span>
          <button
            type="button"
            onClick={() => onAlignPoints('left')}
            title="Align dots Left"
            className={`p-1 rounded border ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 hover:text-white border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border-gray-200'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onAlignPoints('centerX')}
            title="Align dots Center Horizontally"
            className={`p-1 rounded border ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 hover:text-white border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border-gray-200'
            }`}
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onAlignPoints('right')}
            title="Align dots Right"
            className={`p-1 rounded border ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 hover:text-white border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border-gray-200'
            }`}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onAlignPoints('top')}
            title="Align dots Top"
            className={`p-1 rounded border ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 hover:text-white border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border-gray-200'
            }`}
          >
            <AlignStartVertical className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onAlignPoints('centerY')}
            title="Align dots Middle Vertically"
            className={`p-1 rounded border ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 hover:text-white border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border-gray-200'
            }`}
          >
            <AlignCenterVertical className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onAlignPoints('bottom')}
            title="Align dots Bottom"
            className={`p-1 rounded border ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 hover:text-white border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border-gray-200'
            }`}
          >
            <AlignEndVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Numeric Coords */}
      {!multiSelect && selectedPoint && (
        <div className={`flex items-center gap-2 pr-2 border-r ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-1">
            <span className={`font-mono text-[11px] ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>X</span>
            <input
              type="number"
              value={Math.round(selectedPoint.x)}
              onChange={(e) =>
                onUpdatePointCoords(Number(e.target.value), selectedPoint.y)
              }
              className={`w-14 px-1.5 py-0.5 rounded text-xs font-mono text-center border focus:outline-none focus:border-[#F43F5E] ${
                isDark ? 'bg-[#242424] border-[#2A2A2A] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className={`font-mono text-[11px] ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>Y</span>
            <input
              type="number"
              value={Math.round(selectedPoint.y)}
              onChange={(e) =>
                onUpdatePointCoords(selectedPoint.x, Number(e.target.value))
              }
              className={`w-14 px-1.5 py-0.5 rounded text-xs font-mono text-center border focus:outline-none focus:border-[#F43F5E] ${
                isDark ? 'bg-[#242424] border-[#2A2A2A] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            />
          </div>
        </div>
      )}

      {/* Path state and Delete */}
      <div className="flex items-center gap-2">
        {totalPointsInPath >= 3 && (
          <button
            type="button"
            onClick={onToggleClosePath}
            title={isClosed ? 'Open Path' : 'Close Path'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
            }`}
          >
            {isClosed ? <Lock className="w-3 h-3 text-[#F43F5E]" /> : <Unlock className={`w-3 h-3 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />}
            <span>{isClosed ? 'Closed' : 'Open'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onDeletePoint}
          title="Delete selected point(s) (Backspace / Del)"
          className={`p-1 rounded transition-colors ${
            isDark
              ? 'hover:bg-rose-950/60 text-neutral-400 hover:text-rose-400'
              : 'hover:bg-rose-100 text-gray-400 hover:text-rose-600'
          }`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
