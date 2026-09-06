import React, { useEffect, useRef, useState } from 'react';
import { ImageTraceOptions, traceRasterImage } from '../utils/vectorTrace';
import { featherAlphaEdge, floodRemoveBackground } from '../utils/backgroundRemoval';
import { VectorShape } from '../types';
import { shapeToSvgPath } from '../utils/bezier';
import { useTheme } from '../context/ThemeContext';
import { Wand2, X, Sliders, Check, Eraser, Undo2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  imageSrc: string;
  filename: string;
  isNewProject: boolean;
  onClose: () => void;
  onConfirm: (shapes: VectorShape[], dimensions: { width: number; height: number }, replaceCanvas: boolean) => void;
}


interface EdgeStats {
  /** Whether the tracer will read alpha rather than brightness. */
  usesAlpha: boolean;
  /** Share of pixels that are partly transparent — the only ones a threshold
   *  change can flip. A hard-edged cutout has almost none, which is why moving
   *  the slider appears to do nothing. */
  softPct: number;
}

function analyzeEdges(image: ImageData): EdgeStats {
  const d = image.data;
  let anyBelowOpaque = false;
  let soft = 0;

  for (let i = 3; i < d.length; i += 4) {
    const a = d[i];
    if (a < 240) anyBelowOpaque = true;
    if (a > 0 && a < 255) soft++;
  }

  return {
    usesAlpha: anyBelowOpaque,
    softPct: (soft / (d.length / 4)) * 100,
  };
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
    smoothing: 1,
    detectAlpha: true,
    fillHoles: true,
  });

  const [previewShapes, setPreviewShapes] = useState<VectorShape[]>([]);
  const [imgDim, setImgDim] = useState<{ width: number; height: number }>({ width: 800, height: 800 });
  const [isTracing, setIsTracing] = useState(false);
  const [replaceCanvas, setReplaceCanvas] = useState(isNewProject);

  // Background eraser: `workingSrc` is the image after any erasing, and is what
  // gets traced. The original is kept so Reset is always available.
  const [eraseMode, setEraseMode] = useState(false);
  const [eraseTolerance, setEraseTolerance] = useState(18);
  const [workingSrc, setWorkingSrc] = useState(imageSrc);
  const [erasedCount, setErasedCount] = useState(0);
  const [edgeStats, setEdgeStats] = useState<EdgeStats | null>(null);
  const workingData = useRef<ImageData | null>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);

  // Load the source into an ImageData buffer the eraser can work on.
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!active) return;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      workingData.current = ctx.getImageData(0, 0, c.width, c.height);
      setEdgeStats(analyzeEdges(workingData.current));
      setWorkingSrc(imageSrc);
      setErasedCount(0);
    };
    img.src = imageSrc;
    return () => {
      active = false;
    };
  }, [isOpen, imageSrc]);

  const commitWorkingData = () => {
    const data = workingData.current;
    if (!data) return;
    const c = document.createElement('canvas');
    c.width = data.width;
    c.height = data.height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(data, 0, 0);
    setEdgeStats(analyzeEdges(data));
    setWorkingSrc(c.toDataURL('image/png'));
  };

  // Map a click on the letterboxed preview back to a source pixel.
  const handleErase = (e: React.MouseEvent) => {
    const data = workingData.current;
    const box = previewBoxRef.current;
    if (!eraseMode || !data || !box) return;

    const rect = box.getBoundingClientRect();
    const scale = Math.min(rect.width / data.width, rect.height / data.height);
    const drawnW = data.width * scale;
    const drawnH = data.height * scale;
    const originX = rect.left + (rect.width - drawnW) / 2;
    const originY = rect.top + (rect.height - drawnH) / 2;

    const px = (e.clientX - originX) / scale;
    const py = (e.clientY - originY) / scale;
    if (px < 0 || py < 0 || px >= data.width || py >= data.height) return;

    const { removed } = floodRemoveBackground(data, px, py, eraseTolerance);
    if (removed === 0) return;
    featherAlphaEdge(data);
    setErasedCount((n) => n + removed);
    commitWorkingData();
  };

  const handleResetErase = () => {
    setWorkingSrc(imageSrc);
    setErasedCount(0);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      workingData.current = ctx.getImageData(0, 0, c.width, c.height);
      setEdgeStats(analyzeEdges(workingData.current));
    };
    img.src = imageSrc;
  };

  useEffect(() => {
    setReplaceCanvas(isNewProject);
  }, [isNewProject]);

  useEffect(() => {
    if (!isOpen || !workingSrc) return;

    let active = true;
    setIsTracing(true);

    const timer = setTimeout(async () => {
      try {
        const result = await traceRasterImage(workingSrc, options);
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
  }, [isOpen, workingSrc, options]);

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
            <div
              ref={previewBoxRef}
              onClick={handleErase}
              className={`relative w-full aspect-square max-h-[360px] rounded overflow-hidden border flex items-center justify-center ${
                eraseMode ? 'cursor-crosshair' : ''
              } ${isDark ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'}`}
            >
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
                src={workingSrc}
                alt="Source"
                className={`absolute max-w-full max-h-full object-contain pointer-events-none ${
                  eraseMode ? 'opacity-90' : 'opacity-35 filter grayscale'
                }`}
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
                      d={shapeToSvgPath(s)}
                      fillRule="evenodd"
                      fill="rgba(244, 63, 94, 0.35)"
                      stroke="#F43F5E"
                      strokeWidth={Math.max(2, imgDim.width * 0.004)}
                      strokeLinejoin="round"
                    />
                  ))}

                  {/* Anchors, sized off the image so they stay small at any scale */}
                  {previewShapes.flatMap((s) =>
                    [s.points, ...(s.subPaths ?? [])].flatMap((contour, ci) =>
                      contour.map((p, pi) => (
                        <circle
                          key={`${s.id}_${ci}_${pi}`}
                          cx={p.x}
                          cy={p.y}
                          r={Math.max(1, imgDim.width * 0.004)}
                          fill="#ffffff"
                          stroke="#F43F5E"
                          strokeWidth={Math.max(0.5, imgDim.width * 0.0015)}
                        />
                      ))
                    )
                  )}
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
              {eraseMode
                ? 'Click any background area to erase it. Click again to remove more.'
                : 'Red-pink overlay indicates the vector frame contour that will be generated.'}
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 flex flex-col justify-between space-y-6 overflow-y-auto">
            <div className="space-y-5">
              {/* Background eraser */}
              <div className={`p-3 rounded border space-y-2.5 ${
                isDark ? 'bg-[#242424]/40 border-[#2A2A2A]' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setEraseMode((v) => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                      eraseMode
                        ? 'bg-gradient-to-r from-[#F43F5E] to-[#FF5722] text-white border-transparent'
                        : isDark
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-300 hover:text-white'
                          : 'bg-white border-gray-300 text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    {eraseMode ? 'Erasing Background' : 'Remove Background'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetErase}
                    disabled={erasedCount === 0}
                    title="Restore the original image"
                    className={`flex items-center gap-1 px-2 py-1.5 rounded text-[11px] border disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer ${
                      isDark ? 'border-[#2A2A2A] text-neutral-400 hover:text-white' : 'border-gray-300 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>

                {eraseMode && (
                  <>
                    <div className={`flex justify-between text-xs ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                      <span>Colour Tolerance</span>
                      <span className="font-mono text-[#F43F5E]">{eraseTolerance}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={80}
                      value={eraseTolerance}
                      onChange={(e) => setEraseTolerance(Number(e.target.value))}
                      className="w-full accent-[#F43F5E]"
                    />
                    <div className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                      {erasedCount > 0
                        ? `${erasedCount.toLocaleString()} px erased. Click more areas to continue.`
                        : 'Click a background area in the preview to erase it.'}
                    </div>
                  </>
                )}
              </div>

              <div className={`flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider ${
                isDark ? 'text-neutral-400' : 'text-gray-500'
              }`}>
                <Sliders className="w-4 h-4 text-[#FF5722]" />
                Outline Tuning Controls
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

              {/* What counts as the picture */}
              <div>
                <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  <span>What Counts as the Picture</span>
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
                <span className={`text-[11px] block ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  {!edgeStats
                    ? 'Decides which parts of the image are kept and which are thrown away.'
                    : edgeStats.usesAlpha
                      ? 'Slide right to keep only the solid parts. Slide left to also keep the faint, see-through edges.'
                      : 'This image has no see-through parts, so light and dark are used instead. Slide right to keep lighter parts too. Slide left to keep only the darkest parts.'}
                </span>
                {edgeStats?.usesAlpha && edgeStats.softPct < 5 && (
                  <span className={`text-[11px] block mt-1 ${isDark ? 'text-amber-400/80' : 'text-amber-600'}`}>
                    This image has a crisp edge — only {edgeStats.softPct.toFixed(1)}% of it is
                    faded — so this slider will hardly change anything.
                  </span>
                )}
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
