import React, { useState } from 'react';
import { CanvasDimensions } from '../types';
import { useTheme } from '../context/ThemeContext';
import { LayoutGrid, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (dimensions: CanvasDimensions) => void;
  currentDimensions: CanvasDimensions;
}

const PRESETS: { name: string; width: number; height: number; description: string }[] = [
  { name: 'Instagram Post / Square', width: 1080, height: 1080, description: '1080 × 1080 px (1:1)' },
  { name: 'Canva Story / Reel', width: 1080, height: 1920, description: '1080 × 1920 px (9:16)' },
  { name: 'Landscape / Banner', width: 1200, height: 630, description: '1200 × 630 px (1.91:1)' },
  { name: 'Canva Presentation', width: 1920, height: 1080, description: '1920 × 1080 px (16:9)' },
  { name: 'A4 Document', width: 1240, height: 1754, description: '1240 × 1754 px (1:1.41)' },
  { name: 'Icon / Badge', width: 512, height: 512, description: '512 × 512 px (1:1)' },
];

export const NewProjectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreate,
  currentDimensions,
}) => {
  const { isDark } = useTheme();
  const [width, setWidth] = useState(currentDimensions.width);
  const [height, setHeight] = useState(currentDimensions.height);
  const [selectedPreset, setSelectedPreset] = useState<string>('Instagram Post / Square');

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof PRESETS[0]) => {
    setSelectedPreset(preset.name);
    setWidth(preset.width);
    setHeight(preset.height);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (width > 0 && height > 0) {
      onCreate({ width: Math.round(width), height: Math.round(height), name: selectedPreset });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className={`w-full max-w-lg rounded-md border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors ${
        isDark ? 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-100' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-[#F43F5E]" />
            <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>New Canva Frame Project</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${
              isDark ? 'hover:bg-[#242424] text-neutral-400 hover:text-neutral-200' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className={`block text-[11px] font-mono uppercase tracking-wider mb-3 ${
              isDark ? 'text-neutral-400' : 'text-gray-500'
            }`}>
              Standard Canva Dimensions Preset
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-3 rounded text-left border transition-all ${
                    selectedPreset === preset.name
                      ? isDark
                        ? 'border-[#F43F5E] bg-[#F43F5E]/10 text-white shadow-xs'
                        : 'border-[#F43F5E] bg-[#F43F5E]/10 text-gray-900 shadow-xs'
                      : isDark
                      ? 'border-[#2A2A2A] bg-[#242424]/60 hover:bg-[#2A2A2A] text-neutral-300'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="text-sm font-medium">{preset.name}</div>
                  <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-[11px] font-mono uppercase tracking-wider mb-3 ${
              isDark ? 'text-neutral-400' : 'text-gray-500'
            }`}>
              Custom Canvas Size (Pixels)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className={`text-xs block mb-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Width (px)</span>
                <input
                  type="number"
                  min={100}
                  max={6000}
                  value={width}
                  onChange={(e) => {
                    setWidth(Number(e.target.value));
                    setSelectedPreset('Custom');
                  }}
                  className={`w-full px-3 py-2 rounded text-sm font-mono border focus:outline-none focus:border-[#F43F5E] transition-colors ${
                    isDark ? 'bg-[#242424] border-[#2A2A2A] text-neutral-100' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              <div>
                <span className={`text-xs block mb-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Height (px)</span>
                <input
                  type="number"
                  min={100}
                  max={6000}
                  value={height}
                  onChange={(e) => {
                    setHeight(Number(e.target.value));
                    setSelectedPreset('Custom');
                  }}
                  className={`w-full px-3 py-2 rounded text-sm font-mono border focus:outline-none focus:border-[#F43F5E] transition-colors ${
                    isDark ? 'bg-[#242424] border-[#2A2A2A] text-neutral-100' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            </div>
          </div>

          <div className={`flex items-center justify-between pt-3 border-t ${
            isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
          }`}>
            <span className={`text-xs font-mono ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              Aspect Ratio: {((width / height) || 1).toFixed(2)} : 1
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 text-xs font-medium rounded border transition-colors ${
                  isDark ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 border-[#2A2A2A]' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold rounded bg-gradient-to-r from-[#F43F5E] to-[#FF5722] hover:opacity-90 text-white shadow-sm transition-opacity cursor-pointer"
              >
                Create Project
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
