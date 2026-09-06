import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { sanitizeProjectName } from '../utils/projectFile';
import {
  FolderOpen,
  FilePlus,
  Download,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Frame,
  Upload,
  Sun,
  Moon,
  Save,
  FileJson,
  Pencil,
} from 'lucide-react';

interface Props {
  /** The project name, which is also the `.cf.json` basename on save. */
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onNewProject: () => void;
  onFileSelected: (file: File, isNewProject: boolean) => void;
  onSaveProject: () => void;
  /** Opens the file picker for a saved `.cf.json`; the input lives in App. */
  onOpenProject: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onDelete: () => void;
  /** What Delete would remove right now — drives the trash button's tooltip. */
  deleteTarget: 'guide' | 'point' | 'shape' | null;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onFitToScreen: () => void;
  hasOverlays: boolean;
  onOpenGuide: () => void;
}

export const Toolbar: React.FC<Props> = ({
  projectName,
  onProjectNameChange,
  onNewProject,
  onFileSelected,
  onSaveProject,
  onOpenProject,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDelete,
  deleteTarget,
  zoom,
  onZoomChange,
  onFitToScreen,
  hasOverlays,
  onOpenGuide,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const loadFileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Project name editing. The draft is separate from the committed name so
  // Escape can abandon a rename without ever touching app state.
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingName) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [isEditingName]);

  // Escape unmounts the input, and a removed element fires no blur — but the
  // flag makes that a guarantee rather than a browser detail to rely on.
  const cancelledRef = useRef(false);

  const startRename = () => {
    cancelledRef.current = false;
    setNameDraft(projectName);
    setIsEditingName(true);
  };

  // Clicking off, or Enter, confirms. The name is sanitized here rather than on
  // the way into the save dialog so the header shows the name that will
  // actually be written — and an empty field falls back rather than sticking.
  const commitRename = () => {
    setIsEditingName(false);
    const next = sanitizeProjectName(nameDraft);
    if (next !== projectName) onProjectNameChange(next);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isNew: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file, isNew);
    }
    e.target.value = '';
  };

  return (
    <header className={`h-13 border-b px-4 flex items-center justify-between select-none z-30 relative transition-colors ${
      isDark ? 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-200' : 'bg-white border-gray-200 text-gray-800 shadow-xs'
    }`}>
      {/* Hidden File Inputs for SVG & Images */}
      <input
        type="file"
        ref={loadFileInputRef}
        accept=".svg,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => handleFileChange(e, true)}
      />
      <input
        type="file"
        ref={importFileInputRef}
        accept=".svg,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => handleFileChange(e, false)}
      />

      {/* Left: Brand & File Menus */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 pr-3 border-r ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`}>
          <div className={`w-7 h-7 rounded border flex items-center justify-center text-[#F43F5E] shadow-inner ${
            isDark ? 'bg-[#121212] border-[#2A2A2A]' : 'bg-[#F43F5E]/10 border-[#F43F5E]/30'
          }`}>
            <Frame className="w-3.5 h-3.5 text-[#F43F5E]" />
          </div>
          <div>
            <div className={`text-xs font-bold tracking-tight font-sans ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Canva Frame Maker
            </div>
          </div>
        </div>

        {/* Project Operations Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
              isDark
                ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-200 border-[#2A2A2A]'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#FF5722]" />
            <span>Project</span>
            <ChevronDown className={`w-3 h-3 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
          </button>

          {fileMenuOpen && (
            <div
              className={`absolute left-0 top-full mt-1.5 w-60 rounded-lg border shadow-2xl p-1 z-50 space-y-0.5 ${
                isDark ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'
              }`}
              onMouseLeave={() => setFileMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onNewProject();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors ${
                  isDark ? 'hover:bg-[#242424] text-neutral-200' : 'hover:bg-gray-100 text-gray-800'
                }`}
              >
                <FilePlus className="w-4 h-4 text-[#F43F5E]" />
                <div>
                  <div className={`font-medium ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>New Blank Project</div>
                  <div className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Define canvas dimensions</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onOpenProject();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors ${
                  isDark ? 'hover:bg-[#242424] text-neutral-200' : 'hover:bg-gray-100 text-gray-800'
                }`}
              >
                <FileJson className="w-4 h-4 text-sky-500" />
                <div>
                  <div className={`font-medium ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>Open Project</div>
                  <div className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>.cf.json • Ctrl/⌘+O</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onSaveProject();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors ${
                  isDark ? 'hover:bg-[#242424] text-neutral-200' : 'hover:bg-gray-100 text-gray-800'
                }`}
              >
                <Save className="w-4 h-4 text-sky-500" />
                <div>
                  <div className={`font-medium ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>Save Project</div>
                  <div className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>.cf.json • Ctrl/⌘+S</div>
                </div>
              </button>

              <div className={`my-1 border-t ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`} />

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  loadFileInputRef.current?.click();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors ${
                  isDark ? 'hover:bg-[#242424] text-neutral-200' : 'hover:bg-gray-100 text-gray-800'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <div>
                  <div className={`font-medium ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>Start from Image (Load)</div>
                  <div className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>SVG, PNG, JPG, WEBP • Auto-dims</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  importFileInputRef.current?.click();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors ${
                  isDark ? 'hover:bg-[#242424] text-neutral-200' : 'hover:bg-gray-100 text-gray-800'
                }`}
              >
                <Upload className="w-4 h-4 text-emerald-500" />
                <div>
                  <div className={`font-medium ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>Add to Existing Project (Import)</div>
                  <div className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Import image/SVG as new layer</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        <div className={`flex items-center gap-0.5 p-0.5 rounded border ${
          isDark ? 'bg-[#242424] border-[#2A2A2A]' : 'bg-gray-100 border-gray-200'
        }`}>
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1 rounded disabled:opacity-20 transition-colors ${
              isDark ? 'hover:bg-[#2E2E2E] text-neutral-300' : 'hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            className={`p-1 rounded disabled:opacity-20 transition-colors ${
              isDark ? 'hover:bg-[#2E2E2E] text-neutral-300' : 'hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Delete — the Delete key, as a button */}
        <div className={`flex items-center p-0.5 rounded border ${
          isDark ? 'bg-[#242424] border-[#2A2A2A]' : 'bg-gray-100 border-gray-200'
        }`}>
          <button
            type="button"
            disabled={deleteTarget === null}
            onClick={onDelete}
            title={
              deleteTarget === 'guide'
                ? 'Delete selected guides (Del)'
                : deleteTarget === 'point'
                ? 'Delete selected points (Del)'
                : deleteTarget === 'shape'
                ? 'Delete selected shapes (Del)'
                : 'Delete (Del) — nothing selected'
            }
            className={`p-1 rounded disabled:opacity-20 transition-colors ${
              isDark
                ? 'text-neutral-300 enabled:hover:bg-red-500/15 enabled:hover:text-red-400'
                : 'text-gray-700 enabled:hover:bg-red-50 enabled:hover:text-red-600'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Project name — click to rename, click off (or Enter) to confirm */}
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={nameDraft}
            aria-label="Project name"
            maxLength={80}
            placeholder="untitled-frame"
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              if (cancelledRef.current) {
                cancelledRef.current = false;
                return;
              }
              commitRename();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelledRef.current = true;
                setIsEditingName(false);
              }
              // The window shortcuts already ignore inputs, but the key must
              // not bubble out of the field either.
              e.stopPropagation();
            }}
            style={{ width: `${Math.min(30, Math.max(12, nameDraft.length + 2))}ch` }}
            className={`px-2 py-1 rounded text-xs font-medium border outline-none transition-colors ${
              isDark
                ? 'bg-[#121212] border-[#F43F5E] text-neutral-100 placeholder:text-neutral-600'
                : 'bg-white border-[#F43F5E] text-gray-900 placeholder:text-gray-400'
            }`}
          />
        ) : (
          <button
            type="button"
            onClick={startRename}
            title="Click to rename this project"
            className={`group flex items-center gap-1.5 max-w-[26ch] px-2 py-1 rounded text-xs font-medium border border-transparent transition-colors ${
              isDark
                ? 'text-neutral-300 hover:bg-[#242424] hover:border-[#2A2A2A]'
                : 'text-gray-700 hover:bg-gray-100 hover:border-gray-200'
            }`}
          >
            <span className="truncate">{projectName}</span>
            <Pencil
              className={`w-3 h-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${
                isDark ? 'text-neutral-400' : 'text-gray-500'
              }`}
            />
          </button>
        )}
      </div>

      {/* Right: Zoom, Theme, Status, and Export */}
      <div className="flex items-center gap-2.5">
        {/* Zoom Controls */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded border text-xs ${
          isDark ? 'bg-[#242424] border-[#2A2A2A]' : 'bg-gray-100 border-gray-200'
        }`}>
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(0.2, zoom - 0.1))}
            title="Zoom Out"
            className={`p-1 transition-colors ${isDark ? 'hover:text-white text-neutral-400' : 'hover:text-gray-900 text-gray-500'}`}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className={`w-12 text-center font-mono text-[11px] ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(3, zoom + 0.1))}
            title="Zoom In"
            className={`p-1 transition-colors ${isDark ? 'hover:text-white text-neutral-400' : 'hover:text-gray-900 text-gray-500'}`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onFitToScreen}
            title="Fit to Screen"
            className={`p-1 ml-1 border-l pl-1.5 transition-colors ${
              isDark ? 'hover:text-white text-neutral-400 border-[#333333]' : 'hover:text-gray-900 text-gray-500 border-gray-300'
            }`}
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Overlay Status Pill */}
        {hasOverlays ? (
          <div
            onClick={onExport}
            title="Uncombined overlays detected. Click to resolve before Canva export."
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs cursor-pointer hover:bg-amber-500/20 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
              Overlays Detected
            </span>
          </div>
        ) : (
          <div
            title="All layers valid for Canva Frame export"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs ${
              isDark ? 'bg-[#FF5722]/10 border-[#FF5722]/30 text-[#FF5722]' : 'bg-[#FF5722]/10 border-[#FF5722]/30 text-[#EA580C]'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-[#FF5722]" />
            <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
              Canva Ready
            </span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className={`p-1.5 rounded transition-colors border ${
            isDark
              ? 'bg-[#242424] hover:bg-[#2E2E2E] text-amber-300 hover:text-amber-200 border-[#2A2A2A]'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border-gray-200'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Guide / Help */}
        <button
          type="button"
          onClick={onOpenGuide}
          title="Canva Frame Import Guide & SDK info"
          className={`p-1.5 rounded transition-colors border ${
            isDark
              ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 hover:text-white border-[#2A2A2A]'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border-gray-200'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Export Button */}
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-gradient-to-r from-[#F43F5E] to-[#FF5722] hover:from-[#E11D48] hover:to-[#EA580C] text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Canva Frame</span>
        </button>
      </div>
    </header>
  );
};
