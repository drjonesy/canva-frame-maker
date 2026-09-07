import React, { useEffect, useState } from 'react';
import { ShapePresetType, ToolMode } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ParallelIcon } from './ParallelIcon';
import { AddPointIcon } from './AddPointIcon';
import {
  MousePointer2,
  PenTool,
  Shapes,
  Square,
  Circle,
  Heart,
  Star,
  Triangle,
  Hexagon,
  Cloud,
  MessageSquare,
  Sliders,
  Type,
} from 'lucide-react';

interface Props {
  currentTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  onAddPresetShape: (type: ShapePresetType) => void;
  onMirror: () => void;
  canMirror: boolean;
  /** What Mirror will do, or what is still missing before it can. */
  mirrorHint: string;
  onParallel: () => void;
  canParallel: boolean;
  /** What Parallel will do, or what is still missing before it can. */
  parallelHint: string;
}

/**
 * Two right-angle triangles leaning away from each other across a gap — the
 * reflection the Mirror tool performs. The left one is solid and the right one
 * outlined, so it reads as an original and its copy. Lucide has no icon of
 * this shape.
 */
const MirrorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Left triangle: the original, solid */}
    <path d="M9 6 L9 18 L2.5 18 Z" fill="currentColor" />
    {/* Right triangle: the reflected copy, left outlined */}
    <path d="M15 6 L15 18 L21.5 18 Z" />
  </svg>
);

const PRESET_ICONS: { type: ShapePresetType; label: string; icon: React.ReactNode }[] = [
  { type: 'rect', label: 'Rectangle', icon: <Square className="w-4 h-4" /> },
  { type: 'circle', label: 'Circle / Ellipse', icon: <Circle className="w-4 h-4" /> },
  { type: 'arch', label: 'Arch Window Frame', icon: <Sliders className="w-4 h-4 rotate-90" /> },
  { type: 'heart', label: 'Heart', icon: <Heart className="w-4 h-4" /> },
  { type: 'star', label: '5-Point Star', icon: <Star className="w-4 h-4" /> },
  { type: 'triangle', label: 'Triangle', icon: <Triangle className="w-4 h-4" /> },
  { type: 'hexagon', label: 'Hexagon', icon: <Hexagon className="w-4 h-4" /> },
  { type: 'cloud', label: 'Cloud', icon: <Cloud className="w-4 h-4" /> },
  { type: 'speechBubble', label: 'Speech Bubble', icon: <MessageSquare className="w-4 h-4" /> },
];

interface RailButtonProps {
  label: string;
  /** Shown as a key cap beside the label. */
  shortcut?: string;
  description?: string;
  active?: boolean;
  expanded?: boolean;
  /** Dimmed and unclickable, but still hoverable so the tooltip can say why. */
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/**
 * An icon-only rail button with its own tooltip.
 *
 * The rail has no room for text labels, so the name and its shortcut live in a
 * tooltip. It is drawn rather than left to the browser's `title` because the
 * native one is slow to appear, cannot be styled, and gives the shortcut no
 * visual separation from the name.
 */
const RailButton: React.FC<RailButtonProps> = ({
  label,
  shortcut,
  description,
  active = false,
  expanded,
  disabled = false,
  onClick,
  children,
}) => {
  const { isDark } = useTheme();
  const [showTip, setShowTip] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <button
        type="button"
        // `aria-disabled` rather than `disabled`: a disabled button swallows
        // mouse events, and the tooltip explaining why it is off would never
        // open. The click is guarded here instead.
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) onClick();
        }}
        onFocus={() => setShowTip(true)}
        onBlur={() => setShowTip(false)}
        aria-label={label}
        aria-keyshortcuts={shortcut}
        aria-pressed={expanded === undefined ? active : undefined}
        aria-expanded={expanded}
        className={[
          'w-9 h-9 flex items-center justify-center rounded-md border transition-colors',
          disabled ? 'opacity-30 cursor-default' : 'cursor-pointer',
          disabled
            ? `bg-transparent border-transparent ${
                isDark ? 'text-neutral-400' : 'text-gray-600'
              }`
            : active
            ? 'bg-gradient-to-br from-[#F43F5E] to-[#FF5722] text-white border-transparent shadow-xs'
            : isDark
              ? 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-[#242424]'
              : 'bg-transparent border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-200',
        ].join(' ')}
      >
        {children}
      </button>

      {showTip && (
        <div
          role="tooltip"
          className={`absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none rounded-md border shadow-lg px-2.5 py-1.5 ${
            isDark
              ? 'bg-[#242424] border-[#3A3A3A] text-neutral-100'
              : 'bg-white border-gray-200 text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[11px] font-medium">{label}</span>
            {shortcut && (
              <kbd
                className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                  isDark
                    ? 'bg-[#141414] border-[#3A3A3A] text-neutral-300'
                    : 'bg-gray-100 border-gray-300 text-gray-600'
                }`}
              >
                {shortcut}
              </kbd>
            )}
          </div>
          {description && (
            <div
              className={`text-[10px] mt-0.5 max-w-[220px] ${
                isDark ? 'text-neutral-400' : 'text-gray-500'
              }`}
            >
              {description}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ToolRail: React.FC<Props> = ({
  currentTool,
  onSelectTool,
  onAddPresetShape,
  onMirror,
  canMirror,
  mirrorHint,
  onParallel,
  canParallel,
  parallelHint,
}) => {
  const { isDark } = useTheme();
  const [shapesOpen, setShapesOpen] = useState(false);

  // "S" toggles the shapes flyout, and Escape closes it. The rest of the rail's
  // shortcuts live in App's keymap, but this one belongs to the state the
  // flyout keeps for itself. App leaves "s" unbound, so nothing collides.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      // Leave Cmd+S and friends to the browser.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key.toLowerCase() === 's') {
        setShapesOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setShapesOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className={`w-12 shrink-0 border-r flex flex-col items-center gap-1 py-2 select-none z-30 transition-colors ${
        isDark ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'
      }`}
    >
      {/* Select: a solid arrow, the way a selection tool is drawn everywhere. */}
      <RailButton
        label="Select & Move"
        shortcut="Q"
        active={currentTool === 'select'}
        onClick={() => onSelectTool('select')}
      >
        <MousePointer2 className="w-4 h-4" fill="currentColor" />
      </RailButton>

      {/* Sub-Select: the same arrow left hollow, so the pair reads as a set. */}
      <RailButton
        label="Sub-Select"
        shortcut="W"
        description="Edit points and handles"
        active={currentTool === 'directSelect'}
        onClick={() => onSelectTool('directSelect')}
      >
        <MousePointer2 className="w-4 h-4" fill="none" />
      </RailButton>

      <RailButton
        label="Pen Tool"
        shortcut="E"
        description="Add points, curves and break handles"
        active={currentTool === 'pen'}
        onClick={() => onSelectTool('pen')}
      >
        <PenTool className="w-4 h-4" />
      </RailButton>

      {/* Add Anchor: the Pen's other half. The Pen extends a path from its end,
          which a closed outline no longer has — this one splits a segment
          wherever you click on it instead. */}
      <RailButton
        label="Add Anchor Point"
        shortcut="A"
        description="Click an outline to drop a point on it"
        active={currentTool === 'addPoint'}
        onClick={() => onSelectTool('addPoint')}
      >
        <AddPointIcon className="w-4 h-4" />
      </RailButton>

      {/* Basic shapes, as a flyout so the rail stays one icon wide. */}
      <div className="relative">
        <RailButton
          label="Basic Shapes"
          shortcut="S"
          expanded={shapesOpen}
          onClick={() => setShapesOpen((v) => !v)}
        >
          <Shapes className="w-4 h-4" />
        </RailButton>

        {shapesOpen && (
          <div
            className={`absolute left-full top-0 ml-1.5 w-52 rounded-lg border shadow-2xl p-1 z-50 grid grid-cols-1 gap-0.5 ${
              isDark ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'
            }`}
            onMouseLeave={() => setShapesOpen(false)}
          >
            <div
              className={`px-2 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider border-b ${
                isDark ? 'text-neutral-400 border-[#2A2A2A]' : 'text-gray-500 border-gray-200'
              }`}
            >
              Basic Shapes
            </div>
            {PRESET_ICONS.map((preset) => (
              <button
                key={preset.type}
                type="button"
                onClick={() => {
                  onAddPresetShape(preset.type);
                  setShapesOpen(false);
                }}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-left text-xs transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-[#242424] text-neutral-200' : 'hover:bg-gray-100 text-gray-800'
                }`}
              >
                <span className="text-[#F43F5E]">{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text: a mode like the four tools at the top of the rail, not an
          action — you pick it, then click the canvas to place some type and
          start typing. */}
      <RailButton
        label="Text"
        shortcut="T"
        description="Click the canvas and type. Set the family and size in the Text tab."
        active={currentTool === 'text'}
        onClick={() => onSelectTool('text')}
      >
        <Type className="w-4 h-4" />
      </RailButton>

      <div className={`w-6 my-1 border-t ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`} />

      {/* Mirror is an action, not a mode: it reflects the selection across the
          picked guide there and then, so it sits below the divider with the
          preset shapes rather than with the three tools above it. */}
      <RailButton
        label="Mirror"
        shortcut="M"
        description={mirrorHint}
        disabled={!canMirror}
        onClick={onMirror}
      >
        <MirrorIcon className="w-4 h-4" />
      </RailButton>

      {/* Parallel, likewise an action: it turns the selection where it stands
          until the picked edge runs along the picked guide. */}
      <RailButton
        label="Parallel to Guide"
        shortcut="P"
        description={parallelHint}
        disabled={!canParallel}
        onClick={onParallel}
      >
        <ParallelIcon className="w-4 h-4" />
      </RailButton>
    </div>
  );
};
