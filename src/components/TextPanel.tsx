import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TextStyle, VectorShape } from '../types';
import { useTheme } from '../context/ThemeContext';
import { FONT_CATEGORIES, GOOGLE_FONTS } from '../data/googleFonts';
import {
  ensurePreviewFaces,
  fontCapabilities,
  fontStack,
} from '../utils/googleFonts';
import { OverlineIcon } from './OverlineIcon';
import {
  Bold,
  Check,
  ChevronDown,
  Italic,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  Shapes,
  Strikethrough,
  Type,
  Underline,
} from 'lucide-react';

interface Props {
  /** The one selected text layer, or null when the selection is not that. */
  shape: VectorShape | null;
  selectedCount: number;
  /** A face is still downloading, so the outlines on screen are a step behind. */
  loading: boolean;
  /** Why the last font load failed, if it did. */
  error: string | null;
  onChange: (patch: Partial<TextStyle>) => void;
  onConvertToObjects: () => void;
  onAddText: () => void;
}

/** Sizes worth one click, spanning a caption to a poster headline. */
const SIZE_PRESETS = [48, 96, 160, 280];

/** How many families the picker draws at once — see the note on the list. */
const PICKER_LIMIT = 80;

/** Roughly how tall the open picker is, for deciding which way it opens. */
const PICKER_HEIGHT_PX = 360;

const fieldClass = (isDark: boolean) =>
  `w-full px-2 py-1.5 rounded-lg border text-xs font-mono focus:outline-none focus:border-[#F43F5E] transition-colors ${
    isDark
      ? 'bg-[#141414] border-[#2A2A2A] text-neutral-200'
      : 'bg-white border-gray-200 text-gray-800'
  }`;

const labelClass = (isDark: boolean) =>
  `text-[10px] font-semibold uppercase tracking-wider ${
    isDark ? 'text-neutral-500' : 'text-gray-400'
  }`;

/* ------------------------------------------------------------------ */
/* Family picker                                                       */
/* ------------------------------------------------------------------ */

const FontPicker: React.FC<{
  value: string;
  onPick: (family: string) => void;
}> = ({ value, onPick }) => {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  // The Text tab sits at the bottom of a scrolling column that clips its own
  // overflow, so a list hung below the button there is simply out of sight.
  // Which way it opens is decided once, on opening, from where the button
  // actually is — flipping it mid-scroll would be worse than either choice.
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return GOOGLE_FONTS.filter(
      (f) =>
        (!category || f.category === category) &&
        (!needle || f.family.toLowerCase().includes(needle))
    );
  }, [query, category]);

  /**
   * Only the rows on offer are drawn, and only their faces are requested. The
   * catalogue is 400 families; asking Google for all of them to render a list
   * would be several megabytes of webfont for a panel most of which is
   * scrolled past. Searching narrows it, which is the point of the field.
   */
  const shown = matches.slice(0, PICKER_LIMIT);

  useEffect(() => {
    if (open) ensurePreviewFaces(shown.map((f) => f.family));
  }, [open, shown]);

  // The current family's own face is wanted for the closed button too.
  useEffect(() => {
    ensurePreviewFaces([value]);
  }, [value]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        onClick={() => {
          if (!open) {
            const rect = buttonRef.current?.getBoundingClientRect();
            setDropUp(!!rect && rect.bottom + PICKER_HEIGHT_PX > window.innerHeight);
          }
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
          isDark
            ? 'bg-[#141414] border-[#2A2A2A] hover:border-[#3A3A3A] text-neutral-200'
            : 'bg-white border-gray-200 hover:border-gray-300 text-gray-800'
        }`}
      >
        <span
          className="flex-1 min-w-0 truncate text-sm"
          style={{ fontFamily: fontStack(value) }}
        >
          {value}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          } ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 z-40 rounded-lg border shadow-2xl overflow-hidden ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${isDark ? 'bg-[#1F1F1F] border-[#333]' : 'bg-white border-gray-200'}`}
        >
          <div
            className={`p-2 border-b space-y-2 ${
              isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
            }`}
          >
            <div className="relative">
              <Search
                className={`absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                  isDark ? 'text-neutral-600' : 'text-gray-400'
                }`}
              />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${GOOGLE_FONTS.length} Google Fonts…`}
                className={`${fieldClass(isDark)} pl-7 font-sans`}
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {[null, ...FONT_CATEGORIES].map((c) => (
                <button
                  key={c ?? 'all'}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    category === c
                      ? 'bg-[#F43F5E] text-white'
                      : isDark
                      ? 'bg-[#2A2A2A] text-neutral-400 hover:text-neutral-200'
                      : 'bg-gray-100 text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {c ?? 'All'}
                </button>
              ))}
            </div>
          </div>

          <div role="listbox" className="max-h-64 overflow-y-auto py-1">
            {shown.length === 0 && (
              <div
                className={`px-3 py-6 text-center text-xs ${
                  isDark ? 'text-neutral-500' : 'text-gray-400'
                }`}
              >
                No family matches “{query}”.
              </div>
            )}
            {shown.map((font) => (
              <button
                key={font.family}
                type="button"
                role="option"
                aria-selected={font.family === value}
                onClick={() => {
                  onPick(font.family);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-[#2A2A2A]' : 'hover:bg-gray-100'
                }`}
              >
                <span
                  className={`flex-1 min-w-0 truncate text-sm ${
                    isDark ? 'text-neutral-200' : 'text-gray-800'
                  }`}
                  /* Each row is set in its own face, which is the only way to
                     choose a typeface — a list of names in one font tells you
                     nothing about any of them. */
                  style={{ fontFamily: fontStack(font.family) }}
                >
                  {font.family}
                </span>
                {font.family === value && (
                  <Check className="w-3.5 h-3.5 shrink-0 text-[#F43F5E]" />
                )}
              </button>
            ))}
            {matches.length > shown.length && (
              <div
                className={`px-3 py-2 text-[10px] ${
                  isDark ? 'text-neutral-600' : 'text-gray-400'
                }`}
              >
                {matches.length - shown.length} more — keep typing to narrow it.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

/** A number field that tolerates being emptied or left mid-number while typed. */
const NumberField: React.FC<{
  value: number;
  step: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}> = ({ value, step, min, max, suffix, onChange }) => {
  const { isDark } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
    setDraft(null);
  };

  const nudge = (delta: number) =>
    onChange(
      Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100))
    );

  const button = `px-1.5 py-1 rounded-md border transition-colors cursor-pointer ${
    isDark
      ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-400'
      : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500'
  }`;

  return (
    <div className="flex items-center gap-1">
      <button type="button" className={button} onClick={() => nudge(-step)}>
        <Minus className="w-3 h-3" />
      </button>
      <div className="relative flex-1">
        <input
          type="text"
          inputMode="decimal"
          value={draft ?? String(Math.round(value * 100) / 100)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setDraft(null);
            // The window shortcuts already skip inputs, but a field that lives
            // beside the canvas must not leak a stray key to it by any route.
            e.stopPropagation();
          }}
          className={`${fieldClass(isDark)} text-center ${suffix ? 'pr-6' : ''}`}
        />
        {suffix && (
          <span
            className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none ${
              isDark ? 'text-neutral-600' : 'text-gray-400'
            }`}
          >
            {suffix}
          </span>
        )}
      </div>
      <button type="button" className={button} onClick={() => nudge(step)}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};

export const TextPanel: React.FC<Props> = ({
  shape,
  selectedCount,
  loading,
  error,
  onChange,
  onConvertToObjects,
  onAddText,
}) => {
  const { isDark } = useTheme();
  const style = shape?.text ?? null;
  const capabilities = fontCapabilities(style?.fontFamily ?? '');

  if (!style) {
    return (
      <div className="space-y-3">
        <div
          className={`text-[11px] leading-relaxed ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}
        >
          {selectedCount > 1
            ? 'Several layers are selected. Pick a single text layer to change its font.'
            : selectedCount === 1
            ? 'That layer is plain outlines, not editable text. Converting text to objects is one-way, so only layers still marked with a T in Layers can be retyped.'
            : 'Pick the Text tool (T) and click the canvas to set some type, or drop a text layer at the middle of the canvas:'}
        </div>
        <button
          type="button"
          onClick={onAddText}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-br from-[#F43F5E] to-[#FF5722] hover:opacity-90 transition-opacity cursor-pointer"
        >
          <Type className="w-3.5 h-3.5" />
          Add Text Layer
        </button>
      </div>
    );
  }

  const toggle = (
    active: boolean,
    enabled: boolean,
    label: string,
    title: string,
    icon: React.ReactNode,
    onClick: () => void
  ) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      aria-pressed={active}
      // `aria-disabled` rather than `disabled`, so the tooltip saying why a
      // family has no bold still opens on hover.
      aria-disabled={!enabled || undefined}
      title={title}
      onClick={() => enabled && onClick()}
      className={`flex-1 flex items-center justify-center py-1.5 rounded-md border transition-colors ${
        !enabled
          ? 'opacity-30 cursor-default border-transparent'
          : active
          ? 'bg-[#F43F5E] border-[#F43F5E] text-white cursor-pointer'
          : isDark
          ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-400 cursor-pointer'
          : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500 cursor-pointer'
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* What it says. The canvas is the natural place to type, but a layer
          scrolled off screen still has to be fixable from here. */}
      <div className="space-y-1">
        <div className={labelClass(isDark)}>Text</div>
        <textarea
          rows={2}
          value={style.content}
          onChange={(e) => onChange({ content: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
          className={`${fieldClass(isDark)} font-sans resize-y leading-snug`}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className={labelClass(isDark)}>Font</span>
          {loading && (
            <span className="flex items-center gap-1 text-[10px] text-[#F43F5E]">
              <LoaderCircle className="w-3 h-3 animate-spin" />
              Loading face…
            </span>
          )}
        </div>
        <FontPicker
          value={style.fontFamily}
          onPick={(fontFamily) => onChange({ fontFamily })}
        />
      </div>

      {error && (
        <div className="text-[10px] leading-relaxed text-rose-500">{error}</div>
      )}

      <div className="space-y-1">
        <div className={labelClass(isDark)}>Style</div>
        <div className="flex items-center gap-1">
          {toggle(
            style.bold,
            capabilities.canBold,
            'Bold',
            capabilities.canBold
              ? 'Bold'
              : `${style.fontFamily} ships a single weight, so it has no bold.`,
            <Bold className="w-3.5 h-3.5" />,
            () => onChange({ bold: !style.bold })
          )}
          {toggle(
            style.italic,
            capabilities.canItalic,
            'Italic',
            capabilities.canItalic
              ? 'Italic'
              : `${style.fontFamily} has no italic. A slanted copy of the upright would not be one.`,
            <Italic className="w-3.5 h-3.5" />,
            () => onChange({ italic: !style.italic })
          )}
          {toggle(
            style.underline,
            true,
            'Underline',
            'Underline',
            <Underline className="w-3.5 h-3.5" />,
            () => onChange({ underline: !style.underline })
          )}
          {toggle(
            style.overline,
            true,
            'Overline',
            'Overline',
            <OverlineIcon className="w-3.5 h-3.5" />,
            () => onChange({ overline: !style.overline })
          )}
          {toggle(
            style.lineThrough,
            true,
            'Strike-through',
            'Strike-through',
            <Strikethrough className="w-3.5 h-3.5" />,
            () => onChange({ lineThrough: !style.lineThrough })
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className={labelClass(isDark)}>Size</div>
        <NumberField
          value={style.fontSize}
          step={4}
          min={1}
          max={2000}
          suffix="px"
          onChange={(fontSize) => onChange({ fontSize })}
        />
        <div className="flex gap-1">
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ fontSize: preset })}
              className={`flex-1 py-1 rounded-md border text-[10px] font-mono transition-colors cursor-pointer ${
                Math.round(style.fontSize) === preset
                  ? 'bg-[#F43F5E]/10 border-[#F43F5E]/40 text-[#E11D48] dark:text-[#FB7185]'
                  : isDark
                  ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-400'
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className={labelClass(isDark)}>Letter</div>
          <NumberField
            value={style.letterSpacing}
            step={1}
            min={-500}
            max={500}
            suffix="px"
            onChange={(letterSpacing) => onChange({ letterSpacing })}
          />
        </div>
        <div className="space-y-1">
          <div className={labelClass(isDark)}>Line</div>
          <NumberField
            value={style.lineHeight}
            step={0.1}
            min={0.1}
            max={10}
            suffix="×"
            onChange={(lineHeight) => onChange({ lineHeight })}
          />
        </div>
      </div>
      <div
        className={`text-[10px] leading-relaxed ${
          isDark ? 'text-neutral-600' : 'text-gray-400'
        }`}
      >
        Letter spacing is in canvas px and goes between characters, not after
        the last one. Line spacing is a multiple of the size.
      </div>

      <div
        className={`pt-3 border-t space-y-2 ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}
      >
        <button
          type="button"
          onClick={onConvertToObjects}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
            isDark
              ? 'bg-[#242424] hover:bg-[#2E2E2E] border-[#2A2A2A] text-neutral-200'
              : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
          }`}
        >
          <Shapes className="w-3.5 h-3.5 text-[#FF5722]" />
          Convert to Objects
        </button>
        <div
          className={`text-[10px] leading-relaxed ${
            isDark ? 'text-neutral-500' : 'text-gray-500'
          }`}
        >
          Splits the type into one layer per character. Characters that touch —
          a joined script, or anything an underline runs through — stay together
          as a single welded outline, because cutting them apart mid-stroke
          would leave a notch where they met. This is one-way: the pieces are
          plain outlines and can no longer be retyped.
        </div>
      </div>
    </div>
  );
};
