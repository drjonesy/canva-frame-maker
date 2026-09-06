import React, { useEffect, useState } from 'react';
import { ImageTraceOptions, traceRasterImage } from '../utils/vectorTrace';
import { VectorShape } from '../types';
import { pointsToSvgPath } from '../utils/bezier';
import { useTheme } from '../context/ThemeContext';
import { Wand2, X, Sliders, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  imageSrc: string;
  filename: string;
  isNewProject: boolean;
  onClose: () => void;
  onConfirm: (shapes: VectorShape[], dimensions: { width: number; height: number }, replaceCanvas: boolean) => void;
}

export const ImageTraceModal: React.FC<Props> = ({
  isOpen,
  imageSrc,
  filename,
  isNewProject,
  onClose,
  onConfirm,
}) => {
  const { isDark } = useTheme();
  const [options, setOptions] = useState<ImageTraceOptions>({
    threshold: 128,
    invert: false,
    smoothing: 4,
    detectAlpha: true,
    fillHoles: true,
  });

  const [previewShapes, setPreviewShapes] = useState<VectorShape[]>([]);
  const [imgDim, setImgDim] = useState<{ width: number; height: number }>({ width: 800, height: 800 });
  const [isTracing, setIsTracing] = useState(false);
  const [replaceCanvas, setReplaceCanvas] = useState(isNewProject);

  useEffect(() => {
    setReplaceCanvas(isNewProject);
  }, [isNewProject]);

  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    let active = true;
    setIsTracing(true);

    const timer = setTimeout(async () => {
      try {
        const result = await traceRasterImage(imageSrc, options);
        if (active) {
          setPreviewShapes(result.shapes);
          setImgDim({ width: result.width, height: result.height });
          setIsTracing(false);
        }
      } catch (err) {
        console.error('Tracing error:', err);
        if (active) setIsTracing(false);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, imageSrc, options]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (previewShapes.length > 0) {
      onConfirm(previewShapes, imgDim, replaceCanvas);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className={`w-full max-w-3xl rounded-md border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
        isDark ? 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-100' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-[#F43F5E]" />
            <div>
              <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Convert Image to Canva Frame Outline</h2>
              <p className={`text-xs font-mono ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                Outlining raster image ({filename}) • {imgDim.width} × {imgDim.height} px
              </p>
            </div>
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

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 flex-1 overflow-hidden">
          {/* Visual Preview */}
          <div className={`p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r relative ${
            isDark ? 'bg-[#121212] border-[#2A2A2A]' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className={`relative w-full aspect-square max-h-[360px] rounded overflow-hidden border flex items-center justify-center ${
              isDark ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'
            }`}>
              {/* Checkered pattern background */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: isDark
                    ? 'radial-gradient(circle, #2A2A2A 1.2px, transparent 1.2px)'
                    : 'radial-gradient(circle, #D1D5DB 1.2px, transparent 1.2px)',
                  backgroundSize: '16px 16px',
                }}
              />

              {/* Source image faint preview */}
              <img
                src={imageSrc}
                alt="Source"
                className="absolute max-w-full max-h-full object-contain opacity-35 filter grayscale"
              />

              {/* Traced vector overlay */}
              {previewShapes.length > 0 && (
                <svg
                  viewBox={`0 0 ${imgDim.width} ${imgDim.height}`}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  {previewShapes.map((s) => (
                    <path
                      key={s.id}
                      d={pointsToSvgPath(s.points, true)}
                      fill="rgba(244, 63, 94, 0.35)"
                      stroke="#F43F5E"
                      strokeWidth={Math.max(2, imgDim.width * 0.004)}
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
              )}

              {isTracing && (
                <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-xs ${
                  isDark ? 'bg-[#121212]/80' : 'bg-white/80'
                }`}>
                  <div className="flex items-center gap-2 text-[#F43F5E] text-xs font-mono font-medium">
                    <span className="w-4 h-4 border-2 border-[#F43F5E] border-t-transparent rounded-full animate-spin" />
                    Tracing contour...
                  </div>
                </div>
              )}
            </div>

            <div className={`text-xs mt-3 text-center ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              Red-pink overlay indicates the vector frame contour that will be generated.
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 flex flex-col justify-between space-y-6 overflow-y-auto">
            <div className="space-y-5">
              <div className={`flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider ${
                isDark ? 'text-neutral-400' : 'text-gray-500'
              }`}>
                <Sliders className="w-4 h-4 text-[#FF5722]" />
                Outline Tuning Controls
              </div>

              {/* Threshold */}
              <div>
                <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  <span>Edge / Alpha Threshold</span>
                  <span className="font-mono text-[#F43F5E]">{options.threshold}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={254}
                  value={options.threshold}
                  onChange={(e) =>
                    setOptions({ ...options, threshold: Number(e.target.value) })
                  }
                  className="w-full accent-[#F43F5E]"
                />
                <span className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  Adjust sensitivity for transparent PNG alpha cutouts or contrast edges.
                </span>
              </div>

              {/* Smoothing */}
              <div>
                <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  <span>Curve Smoothing</span>
                  <span className="font-mono text-[#FF5722]">{options.smoothing}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={options.smoothing}
                  onChange={(e) =>
                    setOptions({ ...options, smoothing: Number(e.target.value) })
                  }
                  className="w-full accent-[#FF5722]"
                />
                <span className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  Reduces anchor points and produces smooth continuous Bézier curves.
                </span>
              </div>

              {/* Invert */}
              <div className={`flex items-center justify-between p-3 rounded border ${
                isDark ? 'bg-[#242424]/40 border-[#2A2A2A]' : 'bg-gray-50 border-gray-200'
              }`}>
                <div>
                  <div className={`text-xs font-medium ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>Invert Outline Selection</div>
                  <div className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Switch between subject and background frame</div>
                </div>
                <input
                  type="checkbox"
                  checked={options.invert}
                  onChange={(e) =>
                    setOptions({ ...options, invert: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#F43F5E] rounded cursor-pointer"
                />
              </div>

              {/* Replace / Import mode */}
              <div className={`flex items-center justify-between p-3 rounded border ${
                isDark ? 'bg-[#242424]/40 border-[#2A2A2A]' : 'bg-gray-50 border-gray-200'
              }`}>
                <div>
                  <div className={`text-xs font-medium ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>Adopt Image Canvas Size</div>
                  <div className={`text-[11px] font-mono ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                    Set canvas size to {imgDim.width} × {imgDim.height} px
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={replaceCanvas}
                  onChange={(e) => setReplaceCanvas(e.target.checked)}
                  className="w-4 h-4 accent-[#FF5722] rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Actions */}
            <div className={`flex items-center justify-end gap-2 pt-4 border-t ${
              isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
            }`}>
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
                type="button"
                onClick={handleConfirm}
                disabled={previewShapes.length === 0 || isTracing}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded bg-gradient-to-r from-[#F43F5E] to-[#FF5722] hover:opacity-90 disabled:opacity-40 text-white shadow-sm transition-opacity cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Add Vector Frame
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
