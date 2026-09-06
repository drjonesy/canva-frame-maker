import React from 'react';
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  Crosshair,
} from 'lucide-react';
import { Guide, GuideAlignType, GuideAxis, VectorShape } from '../types';
import { ObjectAlignType } from '../utils/alignment';
import { useTheme } from '../context/ThemeContext';

interface Props {
  selectedShapes: VectorShape[];
  guides: Guide[];
  selectedGuideIds: string[];
  onAlignObjects: (alignType: ObjectAlignType) => void;
  onAlignToGuide: (alignType: GuideAlignType, position: number) => void;
  onCenterOnGuides: (x?: number, y?: number) => void;
}

/**
 * The guide the align buttons act on for one axis: the selected one, or — when
 * nothing is selected and there is only one guide on that axis — that guide,
 * since there is then no ambiguity to resolve.
 */
function resolveActiveGuide(
  guides: Guide[],
  selectedGuideIds: string[],
  axis: GuideAxis
): Guide | null {
  const onAxis = guides.filter((g) => g.axis === axis);
  const picked = onAxis.find((g) => selectedGuideIds.includes(g.id));
  if (picked) return picked;
  return onAxis.length === 1 ? onAxis[0] : null;
}

/**
 * Aligning, in two parts: the selected shapes against each other, and the
 * selection against a guide. A tab body of the right column.
 */
export const AlignTab: React.FC<Props> = ({
  selectedShapes,
  guides,
  selectedGuideIds,
  onAlignObjects,
  onAlignToGuide,
  onCenterOnGuides,
}) => {
  const { isDark } = useTheme();
  const hasMultipleSelected = selectedShapes.length >= 2;
  const hasSelection = selectedShapes.length > 0;

  const activeX = resolveActiveGuide(guides, selectedGuideIds, 'x');
  const activeY = resolveActiveGuide(guides, selectedGuideIds, 'y');
  const canAlignX = hasSelection && activeX !== null;
  const canAlignY = hasSelection && activeY !== null;

  const btnClass = `p-1.5 rounded disabled:opacity-20 flex justify-center transition-colors ${
    isDark
      ? 'hover:bg-[#2E2E2E] text-neutral-300 hover:text-white'
      : 'hover:bg-gray-200 text-gray-700 hover:text-gray-900'
  }`;

  const gridClass = `grid grid-cols-6 gap-1 p-1.5 rounded-lg border ${
    isDark ? 'bg-[#141414] border-[#2A2A2A]' : 'bg-gray-100 border-gray-200'
  }`;

  const muted = isDark ? 'text-neutral-400' : 'text-gray-500';
  const labelClass = `text-[10px] uppercase tracking-wider font-semibold ${muted}`;

  const objectButtons: { type: ObjectAlignType; title: string; icon: React.ReactNode }[] = [
    { type: 'left', title: 'Align Left', icon: <AlignStartVertical className="w-4 h-4" /> },
    { type: 'center', title: 'Align Center Horizontally', icon: <AlignCenterVertical className="w-4 h-4" /> },
    { type: 'right', title: 'Align Right', icon: <AlignEndVertical className="w-4 h-4" /> },
    { type: 'top', title: 'Align Top', icon: <AlignStartHorizontal className="w-4 h-4" /> },
    { type: 'middle', title: 'Align Middle Vertically', icon: <AlignCenterHorizontal className="w-4 h-4" /> },
    { type: 'bottom', title: 'Align Bottom', icon: <AlignEndHorizontal className="w-4 h-4" /> },
  ];

  const guideButtons: {
    type: GuideAlignType;
    title: string;
    guide: Guide | null;
    enabled: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      type: 'left',
      title: 'Left edge to vertical guide',
      guide: activeX,
      enabled: canAlignX,
      icon: <AlignStartVertical className="w-4 h-4" />,
    },
    {
      type: 'centerX',
      title: 'Centre on vertical guide',
      guide: activeX,
      enabled: canAlignX,
      icon: <AlignCenterVertical className="w-4 h-4" />,
    },
    {
      type: 'right',
      title: 'Right edge to vertical guide',
      guide: activeX,
      enabled: canAlignX,
      icon: <AlignEndVertical className="w-4 h-4" />,
    },
    {
      type: 'top',
      title: 'Top edge to horizontal guide',
      guide: activeY,
      enabled: canAlignY,
      icon: <AlignStartHorizontal className="w-4 h-4" />,
    },
    {
      type: 'centerY',
      title: 'Centre on horizontal guide',
      guide: activeY,
      enabled: canAlignY,
      icon: <AlignCenterHorizontal className="w-4 h-4" />,
    },
    {
      type: 'bottom',
      title: 'Bottom edge to horizontal guide',
      guide: activeY,
      enabled: canAlignY,
      icon: <AlignEndHorizontal className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Align the selected shapes to each other */}
      <div>
        <div className={`${labelClass} mb-1.5`}>Align Objects</div>
        <div className={gridClass}>
          {objectButtons.map((b) => (
            <button
              key={b.type}
              type="button"
              disabled={!hasMultipleSelected}
              onClick={() => onAlignObjects(b.type)}
              title={b.title}
              className={btnClass}
            >
              {b.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Align the selection to a guide */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelClass}>Align to Guide</span>
          <span className={`text-[10px] font-mono ${muted}`}>
            {activeX ? `X ${Math.round(activeX.position)}` : 'X —'}
            {'  '}
            {activeY ? `Y ${Math.round(activeY.position)}` : 'Y —'}
          </span>
        </div>

        <div className={gridClass}>
          {guideButtons.map((b) => (
            <button
              key={b.type}
              type="button"
              disabled={!b.enabled}
              title={b.title}
              onClick={() => b.guide && onAlignToGuide(b.type, b.guide.position)}
              className={btnClass}
            >
              {b.icon}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!hasSelection || (!activeX && !activeY)}
          onClick={() => onCenterOnGuides(activeX?.position, activeY?.position)}
          title="Move the selection so its centre sits on the active guides"
          className={`mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-25 ${
            isDark
              ? 'bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border-[#F43F5E]/30 text-[#FB7185]'
              : 'bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border-[#F43F5E]/30 text-[#E11D48]'
          }`}
        >
          <Crosshair className="w-4 h-4 text-[#F43F5E]" />
          Centre Selection on Guides
        </button>

        <p className={`text-[10px] leading-relaxed mt-1.5 ${muted}`}>
          {!hasSelection
            ? 'Select a shape to enable aligning.'
            : guides.length === 0
            ? 'Drag a guide out of a ruler on the Guides tab first.'
            : 'Click a guide on the canvas to choose which one to align to.'}
        </p>
      </div>
    </div>
  );
};
