import React, { useState } from 'react';
import { CanvasDimensions } from '../types';
import { useTheme } from '../context/ThemeContext';
import { FolderOpen, Upload, ImageDown } from 'lucide-react';

interface Props {
  isVisible: boolean;
  dimensions: CanvasDimensions;
  hasShapes: boolean;
  onDropFile: (file: File, isNewProject: boolean) => void;
  onCancel: () => void;
}

type Zone = 'new' | 'import' | null;

const SUPPORTED = '.cf.json, SVG, PNG, JPG, JPEG, WEBP';

export const DropZoneOverlay: React.FC<Props> = ({
  isVisible,
  dimensions,
  hasShapes,
  onDropFile,
  onCancel,
}) => {
  const { isDark } = useTheme();
  const [hoveredZone, setHoveredZone] = useState<Zone>(null);

  if (!isVisible) return null;

  const handleZoneDrop = (e: React.DragEvent, isNewProject: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredZone(null);
    const file = e.dataTransfer.files?.[0];
    onCancel();
    if (file) onDropFile(file, isNewProject);
  };

  const zoneClasses = (zone: Zone, accent: string) =>
    [
      'flex-1 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
      hoveredZone === zone
        ? `${accent} ${isDark ? 'bg-white/5' : 'bg-black/5'}`
        : isDark
          ? 'border-[#3A3A3A] bg-[#1A1A1A]/80'
          : 'border-gray-300 bg-white/80',
    ].join(' ');

  return (
    <div
      className="absolute inset-0 z-100 flex items-center justify-center p-8 bg-black/50 backdrop-blur-xs"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // Dropped in the gutter between zones — treat as a cancel.
        e.preventDefault();
        e.stopPropagation();
        setHoveredZone(null);
        onCancel();
      }}
    >
      <div
        className={`w-full max-w-3xl rounded-md border shadow-2xl overflow-hidden ${
          isDark ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'
        }`}
      >
        <div
          className={`flex items-center gap-2 px-6 py-4 border-b ${
            isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
          }`}
        >
          <ImageDown className="w-5 h-5 text-[#F43F5E]" />
          <div>
            <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Drop your file
            </h2>
            <p className={`text-xs font-mono ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              {SUPPORTED} • one file at a time
            </p>
            <p className={`text-[11px] font-mono ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              {/* A saved project is the whole session, so neither zone applies. */}
              A .cf.json project always opens in place of the current one
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 p-6">
          {/* Start a new project from the dropped file */}
          <div
            className={zoneClasses('new', 'border-[#F43F5E]')}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDragEnter={() => setHoveredZone('new')}
            onDrop={(e) => handleZoneDrop(e, true)}
          >
            <FolderOpen className="w-8 h-8 text-[#F43F5E] pointer-events-none" />
            <div className="pointer-events-none">
              <div className={`text-sm font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                Start a New Project
              </div>
              <div className={`text-[11px] font-mono mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {hasShapes
                  ? 'Replaces current shapes • adopts image size'
                  : 'Canvas adopts the image size'}
              </div>
            </div>
          </div>

          {/* Import into the current project */}
          <div
            className={zoneClasses('import', 'border-emerald-500')}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDragEnter={() => setHoveredZone('import')}
            onDrop={(e) => handleZoneDrop(e, false)}
          >
            <Upload className="w-8 h-8 text-emerald-500 pointer-events-none" />
            <div className="pointer-events-none">
              <div className={`text-sm font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                Add to Current Project
              </div>
              <div className={`text-[11px] font-mono mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                Adds layers • keeps {dimensions.width} × {dimensions.height} px
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
