import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Save, X } from 'lucide-react';
import { PROJECT_FILE_EXT, projectFileName, sanitizeProjectName } from '../utils/projectFile';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Name to start from — the last save's name, or the canvas preset's. */
  defaultName: string;
  shapeCount: number;
  guideCount: number;
  dimensions: { width: number; height: number };
  onSave: (name: string) => void;
}

export const SaveProjectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultName,
  shapeCount,
  guideCount,
  dimensions,
  onSave,
}) => {
  const { isDark } = useTheme();
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-seed on each open: the default follows the last save, and a name typed
  // into a dialog that was then cancelled should not stick around.
  useEffect(() => {
    if (!isOpen) return;
    setName(defaultName);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const finalName = sanitizeProjectName(name);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(finalName);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-md rounded-md border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors ${
          isDark
            ? 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-100'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Save className="w-5 h-5 text-[#F43F5E]" />
            <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Save Project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1 rounded transition-colors ${
              isDark
                ? 'hover:bg-[#242424] text-neutral-400 hover:text-neutral-200'
                : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label
              htmlFor="project-name"
              className={`block text-[11px] font-mono uppercase tracking-wider mb-2 ${
                isDark ? 'text-neutral-400' : 'text-gray-500'
              }`}
            >
              Project Name
            </label>
            <div className="flex items-stretch">
              <input
                id="project-name"
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onClose();
                  // The window-level shortcuts already ignore inputs, but the
                  // key must not bubble out of the dialog either.
                  e.stopPropagation();
                }}
                placeholder="untitled-frame"
                className={`flex-1 min-w-0 px-3 py-2 rounded-l text-sm font-mono border focus:outline-none focus:border-[#F43F5E] transition-colors ${
                  isDark
                    ? 'bg-[#242424] border-[#2A2A2A] text-neutral-100'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
              <span
                className={`flex items-center px-3 rounded-r border border-l-0 text-xs font-mono ${
                  isDark
                    ? 'bg-[#1F1F1F] border-[#2A2A2A] text-neutral-500'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}
              >
                {PROJECT_FILE_EXT}
              </span>
            </div>
            <p className={`text-[11px] font-mono mt-2 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              Saves as {projectFileName(finalName)}
            </p>
          </div>

          <div
            className={`rounded border px-3 py-2.5 text-[11px] font-mono space-y-1 ${
              isDark
                ? 'bg-[#242424]/60 border-[#2A2A2A] text-neutral-400'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <div>
              {shapeCount} layer{shapeCount === 1 ? '' : 's'} · {guideCount} guide
              {guideCount === 1 ? '' : 's'} · {dimensions.width} × {dimensions.height} px
            </div>
            <div className={isDark ? 'text-neutral-500' : 'text-gray-500'}>
              Keeps names, locks, corner radius and anchor types — unlike the SVG export.
            </div>
          </div>

          <div
            className={`flex items-center justify-end gap-2 pt-3 border-t ${
              isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-medium rounded border transition-colors ${
                isDark
                  ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 border-[#2A2A2A]'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded bg-gradient-to-r from-[#F43F5E] to-[#FF5722] hover:opacity-90 text-white shadow-sm transition-opacity cursor-pointer"
            >
              Save File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
