import React from 'react';
import {
  BooleanOperation,
  CanvasDimensions,
  VectorShape,
} from '../types';
import { ObjectAlignType } from '../utils/alignment';
import { getShapeBounds } from '../utils/bezier';
import { useTheme } from '../context/ThemeContext';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Layers,
  MinusCircle,
  Boxes,
  Crop,
  Grid,
  Maximize2,
  Combine,
  Split,
  Palette,
} from 'lucide-react';

interface Props {
  dimensions: CanvasDimensions;
  onUpdateDimensions: (newDims: CanvasDimensions, mode: 'crop' | 'scale') => void;
  selectedShapes: VectorShape[];
  onAlignObjects: (alignType: ObjectAlignType) => void;
  onBooleanOperation: (op: BooleanOperation) => void;
  onGroupShapes: () => void;
  onFlattenShapes: () => void;
  onUpdateShapeStyle: (
    updates: Partial<Pick<VectorShape, 'fillColor' | 'strokeColor' | 'strokeWidth' | 'opacity'>>
  ) => void;
}

export const PropertiesPanel: React.FC<Props> = ({
  dimensions,
  onUpdateDimensions,
  selectedShapes,
  onAlignObjects,
  onBooleanOperation,
  onGroupShapes,
  onFlattenShapes,
  onUpdateShapeStyle,
}) => {
  const { isDark } = useTheme();
  const [resizeMode, setResizeMode] = React.useState<'crop' | 'scale'>('crop');
  const hasMultipleSelected = selectedShapes.length >= 2;
  const hasSelection = selectedShapes.length > 0;
  const primaryShape = selectedShapes[0];

  return (
    <div className={`w-72 border-l flex flex-col h-full select-none overflow-y-auto transition-colors ${
      isDark ? 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-200' : 'bg-white border-gray-200 text-gray-800'
    }`}>
      {/* 1. Canvas Dimensions & Crop/Scale */}
      <div className={`p-4 border-b space-y-3 ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}>
            Canvas Dimensions
          </span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            isDark
              ? 'text-[#FB7185] bg-[#F43F5E]/10 border-[#F43F5E]/30'
              : 'text-[#E11D48] bg-[#F43F5E]/10 border-[#F43F5E]/30'
          }`}>
            {dimensions.width} × {dimensions.height}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className={`text-[11px] block mb-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Width (px)</span>
            <input
              type="number"
              min={100}
              max={6000}
              value={dimensions.width}
              onChange={(e) =>
                onUpdateDimensions(
                  { ...dimensions, width: Math.max(50, Number(e.target.value)) },
                  resizeMode
                )
              }
              className={`w-full px-2.5 py-1.5 rounded-md text-xs font-mono border focus:outline-none focus:border-[#F43F5E] transition-colors ${
                isDark ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            />
          </div>
          <div>
            <span className={`text-[11px] block mb-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Height (px)</span>
            <input
              type="number"
              min={100}
              max={6000}
              value={dimensions.height}
              onChange={(e) =>
                onUpdateDimensions(
                  { ...dimensions, height: Math.max(50, Number(e.target.value)) },
                  resizeMode
                )
              }
              className={`w-full px-2.5 py-1.5 rounded-md text-xs font-mono border focus:outline-none focus:border-[#F43F5E] transition-colors ${
                isDark ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            />
          </div>
        </div>

        {/* Crop vs Scale mode toggle */}
        <div className="flex items-center justify-between pt-1">
          <span className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Resize Strategy:</span>
          <div className={`flex p-0.5 rounded-lg border ${
            isDark ? 'bg-[#121212] border-[#2A2A2A]' : 'bg-gray-100 border-gray-200'
          }`}>
            <button
              type="button"
              onClick={() => setResizeMode('crop')}
              title="Crop Canvas: Changes canvas bounds without distorting existing shapes"
              className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                resizeMode === 'crop'
                  ? 'bg-gradient-to-r from-[#F43F5E] to-[#FF5722] text-white font-semibold shadow-xs'
                  : isDark
                  ? 'text-neutral-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Crop className="w-3 h-3" />
              Crop
            </button>
            <button
              type="button"
              onClick={() => setResizeMode('scale')}
              title="Scale Canvas: Scales canvas and all vector shapes proportionally"
              className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                resizeMode === 'scale'
                  ? 'bg-gradient-to-r from-[#F43F5E] to-[#FF5722] text-white font-semibold shadow-xs'
                  : isDark
                  ? 'text-neutral-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              Scale
            </button>
          </div>
        </div>
      </div>

      {/* 2. Align Objects */}
      <div className={`p-4 border-b space-y-2.5 ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}>
            Align Objects to Side
          </span>
          <span className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
            {hasMultipleSelected ? 'Multi-select' : 'Select 2+'}
          </span>
        </div>

        <div className={`grid grid-cols-6 gap-1 p-1.5 rounded-lg border ${
          isDark ? 'bg-[#141414] border-[#2A2A2A]' : 'bg-gray-100 border-gray-200'
        }`}>
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onAlignObjects('left')}
            title="Align Left"
            className={`p-1.5 rounded disabled:opacity-20 flex justify-center transition-colors ${
              isDark ? 'hover:bg-[#2E2E2E] text-neutral-300 hover:text-white' : 'hover:bg-gray-200 text-gray-700 hover:text-gray-900'
            }`}
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onAlignObjects('center')}
            title="Align Center Horizontally"
            className={`p-1.5 rounded disabled:opacity-20 flex justify-center transition-colors ${
              isDark ? 'hover:bg-[#2E2E2E] text-neutral-300 hover:text-white' : 'hover:bg-gray-200 text-gray-700 hover:text-gray-900'
            }`}
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onAlignObjects('right')}
            title="Align Right"
            className={`p-1.5 rounded disabled:opacity-20 flex justify-center transition-colors ${
              isDark ? 'hover:bg-[#2E2E2E] text-neutral-300 hover:text-white' : 'hover:bg-gray-200 text-gray-700 hover:text-gray-900'
            }`}
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onAlignObjects('top')}
            title="Align Top"
            className={`p-1.5 rounded disabled:opacity-20 flex justify-center transition-colors ${
              isDark ? 'hover:bg-[#2E2E2E] text-neutral-300 hover:text-white' : 'hover:bg-gray-200 text-gray-700 hover:text-gray-900'
            }`}
          >
            <AlignStartVertical className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onAlignObjects('middle')}
            title="Align Middle Vertically"
            className={`p-1.5 rounded disabled:opacity-20 flex justify-center transition-colors ${
              isDark ? 'hover:bg-[#2E2E2E] text-neutral-300 hover:text-white' : 'hover:bg-gray-200 text-gray-700 hover:text-gray-900'
            }`}
          >
            <AlignCenterVertical className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onAlignObjects('bottom')}
            title="Align Bottom"
            className={`p-1.5 rounded disabled:opacity-20 flex justify-center transition-colors ${
              isDark ? 'hover:bg-[#2E2E2E] text-neutral-300 hover:text-white' : 'hover:bg-gray-200 text-gray-700 hover:text-gray-900'
            }`}
          >
            <AlignEndVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Combine Shapes (Boolean Operations) */}
      <div className={`p-4 border-b space-y-3 ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}>
            Combine Shapes (Boolean)
          </span>
          <span className="text-[10px] text-[#FF5722] font-medium">
            New Object
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Group */}
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={onGroupShapes}
            title="Group: Combines selected layers into a grouped compound object"
            className={`flex items-center gap-2 p-2 rounded-lg border disabled:opacity-25 text-left text-xs transition-colors ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-200'
                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
            }`}
          >
            <Combine className="w-4 h-4 text-[#F43F5E] shrink-0" />
            <div>
              <div className="font-medium">Group</div>
              <div className={`text-[10px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Compound frame</div>
            </div>
          </button>

          {/* Subtract */}
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onBooleanOperation('subtract')}
            title="Subtract: Cuts top shape out of the bottom shape, creating a new object"
            className={`flex items-center gap-2 p-2 rounded-lg border disabled:opacity-25 text-left text-xs transition-colors ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-200'
                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
            }`}
          >
            <MinusCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <div className="font-medium">Subtract</div>
              <div className={`text-[10px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Cutout shape</div>
            </div>
          </button>

          {/* Intersect */}
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onBooleanOperation('intersect')}
            title="Intersect: Keeps only the overlapping intersection as a new object"
            className={`flex items-center gap-2 p-2 rounded-lg border disabled:opacity-25 text-left text-xs transition-colors ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-200'
                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
            }`}
          >
            <Boxes className="w-4 h-4 text-[#FF5722] shrink-0" />
            <div>
              <div className="font-medium">Intersect</div>
              <div className={`text-[10px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Overlap only</div>
            </div>
          </button>

          {/* Xor */}
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onBooleanOperation('xor')}
            title="Xor: Keeps everything except the overlapping area as a new object"
            className={`flex items-center gap-2 p-2 rounded-lg border disabled:opacity-25 text-left text-xs transition-colors ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-200'
                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <div className="font-medium">Xor</div>
              <div className={`text-[10px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Exclusion</div>
            </div>
          </button>

          {/* Divide */}
          <button
            type="button"
            disabled={!hasMultipleSelected}
            onClick={() => onBooleanOperation('divide')}
            title="Divide: Slices intersecting shapes into constituent non-overlapping pieces"
            className={`col-span-2 flex items-center gap-2 p-2 rounded-lg border disabled:opacity-25 text-left text-xs transition-colors ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-200'
                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
            }`}
          >
            <Split className="w-4 h-4 text-purple-500 shrink-0" />
            <div>
              <div className="font-medium">Divide</div>
              <div className={`text-[10px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                Slices intersection into separate individual layer objects
              </div>
            </div>
          </button>
        </div>

        {/* Quick Flatten action */}
        <div className={`pt-2 border-t ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`}>
          <button
            type="button"
            onClick={onFlattenShapes}
            title="Flatten All: Combines all visible layers into a single clean Canva Frame"
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
              isDark
                ? 'bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border-[#F43F5E]/30 text-[#FB7185]'
                : 'bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border-[#F43F5E]/30 text-[#E11D48]'
            }`}
          >
            <Grid className="w-4 h-4 text-[#F43F5E]" />
            Flatten All Layers to Unified Frame
          </button>
        </div>
      </div>

      {/* 4. Appearance Styling */}
      {hasSelection && primaryShape && (
        <div className="p-4 space-y-3">
          <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}>
            <Palette className="w-4 h-4 text-[#F43F5E]" />
            Shape Appearance
          </div>

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
        </div>
      )}
    </div>
  );
};
