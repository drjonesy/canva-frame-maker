import React, { useRef, useState } from 'react';
import { ShapePresetType, ToolMode } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  MousePointer,
  PenTool,
  Shapes,
  FolderOpen,
  FilePlus,
  Download,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  Square,
  Circle,
  Heart,
  Star,
  Triangle,
  Hexagon,
  Cloud,
  MessageSquare,
  Sliders,
  ChevronDown,
  Sparkles,
  Upload,
  Sun,
  Moon,
} from 'lucide-react';

interface Props {
  currentTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  onAddPresetShape: (type: ShapePresetType) => void;
  onNewProject: () => void;
  onFileSelected: (file: File, isNewProject: boolean) => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onFitToScreen: () => void;
  hasOverlays: boolean;
  onOpenGuide: () => void;
}

const PRESET_ICONS: { type: ShapePresetType; label: string; icon: React.ReactNode }[] = [
  { type: 'rect', label: 'Rectangle', icon: <Square className="w-4 h-4" /> },
  { type: 'roundedRect', label: 'Rounded Rectangle', icon: <Square className="w-4 h-4 rounded-sm" /> },
  { type: 'circle', label: 'Circle / Ellipse', icon: <Circle className="w-4 h-4" /> },
  { type: 'arch', label: 'Arch Window Frame', icon: <Sliders className="w-4 h-4 rotate-90" /> },
  { type: 'heart', label: 'Heart', icon: <Heart className="w-4 h-4" /> },
  { type: 'star', label: '5-Point Star', icon: <Star className="w-4 h-4" /> },
  { type: 'triangle', label: 'Triangle', icon: <Triangle className="w-4 h-4" /> },
  { type: 'hexagon', label: 'Hexagon', icon: <Hexagon className="w-4 h-4" /> },
  { type: 'cloud', label: 'Cloud', icon: <Cloud className="w-4 h-4" /> },
  { type: 'speechBubble', label: 'Speech Bubble', icon: <MessageSquare className="w-4 h-4" /> },
];

export const Toolbar: React.FC<Props> = ({
  currentTool,
  onSelectTool,
  onAddPresetShape,
  onNewProject,
  onFileSelected,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  onFitToScreen,
  hasOverlays,
  onOpenGuide,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [shapesDropdownOpen, setShapesDropdownOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const loadFileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

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
            <Sparkles className="w-3.5 h-3.5 text-[#F43F5E]" />
          </div>
          <div>
            <div className={`text-xs font-bold tracking-tight flex items-center gap-1.5 font-sans ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Canva Frame Maker
              <span className={`text-[9px] uppercase font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded border ${
                isDark ? 'bg-[#F43F5E]/10 text-[#FB7185] border-[#F43F5E]/30' : 'bg-[#F43F5E]/10 text-[#E11D48] border-[#F43F5E]/30'
              }`}>
                PRO
              </span>
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
      </div>

      {/* Center: Tools Selector */}
      <div className={`flex items-center gap-1 p-0.5 rounded-md border ${
        isDark ? 'bg-[#141414] border-[#2A2A2A]' : 'bg-gray-100 border-gray-200'
      }`}>
        {/* Select Tool */}
        <button
          type="button"
          onClick={() => onSelectTool('select')}
          title="Select & Move (V)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
            currentTool === 'select'
              ? 'bg-gradient-to-r from-[#F43F5E] to-[#FF5722] text-white font-semibold shadow-xs'
              : isDark
              ? 'text-neutral-400 hover:text-white hover:bg-[#242424]'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>Select</span>
        </button>

        {/* Direct Select / Sub-select (Point manipulation) */}
        <button
          type="button"
          onClick={() => onSelectTool('directSelect')}
          title="Sub-Select / Points & Handles (A)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
            currentTool === 'directSelect'
              ? 'bg-gradient-to-r from-[#F43F5E] to-[#FF5722] text-white font-semibold shadow-xs'
              : isDark
              ? 'text-neutral-400 hover:text-white hover:bg-[#242424]'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Sub-Select</span>
        </button>

        {/* Pen Tool */}
        <button
          type="button"
          onClick={() => onSelectTool('pen')}
          title="Pen Tool: Add points, curves, and break handles (P)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
            currentTool === 'pen'
              ? 'bg-gradient-to-r from-[#F43F5E] to-[#FF5722] text-white font-semibold shadow-xs'
              : isDark
              ? 'text-neutral-400 hover:text-white hover:bg-[#242424]'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Pen Tool</span>
        </button>

        {/* Preset Shapes Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShapesDropdownOpen(!shapesDropdownOpen)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              isDark
                ? 'text-neutral-300 hover:text-white hover:bg-[#242424]'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <Shapes className="w-3.5 h-3.5 text-[#FF5722]" />
            <span>Preset Shapes</span>
            <ChevronDown className={`w-3 h-3 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`} />
          </button>

          {shapesDropdownOpen && (
            <div
              className={`absolute left-0 top-full mt-1.5 w-52 rounded-lg border shadow-2xl p-1 z-50 grid grid-cols-1 gap-0.5 ${
                isDark ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'
              }`}
              onMouseLeave={() => setShapesDropdownOpen(false)}
            >
              <div className={`px-2 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider border-b ${
                isDark ? 'text-neutral-400 border-[#2A2A2A]' : 'text-gray-500 border-gray-200'
              }`}>
                Canva Frame Presets
              </div>
              {PRESET_ICONS.map((preset) => (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => {
                    onAddPresetShape(preset.type);
                    setShapesDropdownOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-left text-xs transition-colors ${
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
