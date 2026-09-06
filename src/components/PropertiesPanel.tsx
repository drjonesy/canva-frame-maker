import React from 'react';
import { VectorShape } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props {
  selectedShapes: VectorShape[];
  onUpdateShapeStyle: (
    updates: Partial<Pick<VectorShape, 'fillColor' | 'strokeColor' | 'strokeWidth' | 'opacity'>>
  ) => void;
  onUpdateCornerRadius: (radius: number) => void;
}

/**
 * Fill, stroke, corner radius and opacity of the current selection. A tab body
 * of the right column.
 */
export const PropertiesPanel: React.FC<Props> = ({
  selectedShapes,
  onUpdateShapeStyle,
  onUpdateCornerRadius,
}) => {
  const { isDark } = useTheme();
  const primaryShape = selectedShapes[0];

  if (!primaryShape) {
    return (
      <p className={`text-[10px] leading-relaxed ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
        Select a shape to change its fill, stroke and opacity.
      </p>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      {/* Fill Color */}
      <div className="flex items-center justify-between">
        <span className={isDark ? 'text-neutral-400' : 'text-gray-600'}>Fill Color</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={primaryShape.fillColor}
            onChange={(e) =>
              onUpdateShapeStyle({ fillColor: e.target.value })
            }
            className={`w-6 h-6 rounded border cursor-pointer bg-transparent ${
              isDark ? 'border-[#2A2A2A]' : 'border-gray-300'
            }`}
          />
          <span className={`font-mono text-[11px] uppercase ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {primaryShape.fillColor}
          </span>
        </div>
      </div>

      {/* Stroke Color */}
      <div className="flex items-center justify-between">
        <span className={isDark ? 'text-neutral-400' : 'text-gray-600'}>Stroke Color</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={primaryShape.strokeColor}
            onChange={(e) =>
              onUpdateShapeStyle({ strokeColor: e.target.value })
            }
            className={`w-6 h-6 rounded border cursor-pointer bg-transparent ${
              isDark ? 'border-[#2A2A2A]' : 'border-gray-300'
            }`}
          />
          <span className={`font-mono text-[11px] uppercase ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {primaryShape.strokeColor}
          </span>
        </div>
      </div>

      {/* Corner Radius — rectangles only */}
      {primaryShape.cornerRadiusPct !== undefined && (
        <div>
          <div className={`flex justify-between mb-1 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
            <span>Corner Radius</span>
            <span className={`font-mono ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
              {Math.round(primaryShape.cornerRadiusPct)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={primaryShape.cornerRadiusPct}
            onChange={(e) => onUpdateCornerRadius(Number(e.target.value))}
            className="w-full accent-[#F43F5E]"
          />
        </div>
      )}

      {/* Stroke Width */}
      <div>
        <div className={`flex justify-between mb-1 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
          <span>Stroke Width</span>
          <span className={`font-mono ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>{primaryShape.strokeWidth} px</span>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          value={primaryShape.strokeWidth}
          onChange={(e) =>
            onUpdateShapeStyle({ strokeWidth: Number(e.target.value) })
          }
          className="w-full accent-[#F43F5E]"
        />
      </div>

      {/* Opacity */}
      <div>
        <div className={`flex justify-between mb-1 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
          <span>Opacity</span>
          <span className={`font-mono ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {Math.round(primaryShape.opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={primaryShape.opacity}
          onChange={(e) =>
            onUpdateShapeStyle({ opacity: Number(e.target.value) })
          }
          className="w-full accent-[#FF5722]"
        />
      </div>
    </div>
  );
};
