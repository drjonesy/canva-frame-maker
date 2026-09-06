import React from 'react';
import {
  SquaresUnite,
  SquaresSubtract,
  SquaresIntersect,
  SquaresExclude,
  SquareSplitHorizontal,
  Grid,
} from 'lucide-react';
import { BooleanOperation, VectorShape } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props {
  selectedShapes: VectorShape[];
  onBooleanOperation: (op: BooleanOperation) => void;
  onGroupShapes: () => void;
  onFlattenShapes: () => void;
}

/**
 * Boolean operations on the selection, each producing a new object. A tab body
 * of the right column.
 */
export const MergeTab: React.FC<Props> = ({
  selectedShapes,
  onBooleanOperation,
  onGroupShapes,
  onFlattenShapes,
}) => {
  const { isDark } = useTheme();
  const hasMultipleSelected = selectedShapes.length >= 2;

  const opClass = `flex items-center gap-2 p-2 rounded-lg border disabled:opacity-25 text-left text-xs transition-colors ${
    isDark
      ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-200'
      : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
  }`;
  const captionClass = `text-[10px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {/* Group */}
        <button
          type="button"
          disabled={!hasMultipleSelected}
          onClick={onGroupShapes}
          title="Group: Combines selected layers into a grouped compound object"
          className={opClass}
        >
          <SquaresUnite className="w-4 h-4 text-[#F43F5E] shrink-0" />
          <div>
            <div className="font-medium">Group</div>
            <div className={captionClass}>Compound frame</div>
          </div>
        </button>

        {/* Subtract */}
        <button
          type="button"
          disabled={!hasMultipleSelected}
          onClick={() => onBooleanOperation('subtract')}
          title="Subtract: Cuts top shape out of the bottom shape, creating a new object"
          className={opClass}
        >
          <SquaresSubtract className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <div className="font-medium">Subtract</div>
            <div className={captionClass}>Cutout shape</div>
          </div>
        </button>

        {/* Intersect */}
        <button
          type="button"
          disabled={!hasMultipleSelected}
          onClick={() => onBooleanOperation('intersect')}
          title="Intersect: Keeps only the overlapping intersection as a new object"
          className={opClass}
        >
          <SquaresIntersect className="w-4 h-4 text-[#FF5722] shrink-0" />
          <div>
            <div className="font-medium">Intersect</div>
            <div className={captionClass}>Overlap only</div>
          </div>
        </button>

        {/* Xor */}
        <button
          type="button"
          disabled={!hasMultipleSelected}
          onClick={() => onBooleanOperation('xor')}
          title="Xor: Keeps everything except the overlapping area as a new object"
          className={opClass}
        >
          <SquaresExclude className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <div className="font-medium">Xor</div>
            <div className={captionClass}>Exclusion</div>
          </div>
        </button>

        {/* Divide */}
        <button
          type="button"
          disabled={!hasMultipleSelected}
          onClick={() => onBooleanOperation('divide')}
          title="Divide: Slices intersecting shapes into constituent non-overlapping pieces"
          className={`col-span-2 ${opClass}`}
        >
          <SquareSplitHorizontal className="w-4 h-4 text-purple-500 shrink-0" />
          <div>
            <div className="font-medium">Divide</div>
            <div className={captionClass}>
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
  );
};
