import React, { useEffect, useMemo, useState } from 'react';
import { CanvasDimensions, VectorShape } from '../types';
import { detectOverlays } from '../utils/overlayDetector';
import { checkImportSize } from '../utils/importSizeCheck';
import {
  downloadFile,
  exportShapesToSvg,
  exportToCanvaPdf,
} from '../utils/canvaExport';
import { sanitizeProjectName } from '../utils/projectFile';
import { useTheme } from '../context/ThemeContext';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Sparkles,
  X,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shapes: VectorShape[];
  dimensions: CanvasDimensions;
  projectName: string;
  onFlattenFirst: () => void;
}

export const ExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  shapes,
  dimensions,
  projectName,
  onFlattenFirst,
}) => {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [sizeOverride, setSizeOverride] = useState(false);

  // Overlay detection
  const overlayResult = useMemo(() => {
    return detectOverlays(shapes);
  }, [shapes]);

  // Canva rejects an upload smaller than its minimum design size, and the
  // exported page is cropped to the artwork, so a thin sliver fails to import.
  const sizeCheck = useMemo(
    () => checkImportSize(shapes, dimensions),
    [shapes, dimensions]
  );

  // An "export anyway" only covers the artwork it was granted for: reopening the
  // dialog, or changing the size, puts the block back.
  useEffect(() => {
    setSizeOverride(false);
  }, [isOpen, sizeCheck.smallestSide]);

  const sizeBlocked = sizeCheck.status === 'tooSmall' && !sizeOverride;
  const exportBlocked = overlayResult.hasOverlay || sizeBlocked;

  // The download is named after the project, so an export lands in the user's
  // downloads folder under the same name they see in the toolbar.
  const exportBaseName = sanitizeProjectName(projectName);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    if (exportBlocked) return;
    setIsExportingPdf(true);
    try {
      const pdfBytes = await exportToCanvaPdf(shapes, dimensions);
      downloadFile(
        pdfBytes,
        `${exportBaseName}.pdf`,
        'application/pdf'
      );
    } catch (e) {
      console.error('PDF Export error:', e);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadSvg = () => {
    if (exportBlocked) return;
    const svgStr = exportShapesToSvg(shapes, dimensions, false);
    downloadFile(
      svgStr,
      `${exportBaseName}.svg`,
      'image/svg+xml;charset=utf-8'
    );
  };

  const handleCopySvg = () => {
    if (exportBlocked) return;
    const svgStr = exportShapesToSvg(shapes, dimensions, false);
    navigator.clipboard.writeText(svgStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className={`w-full max-w-2xl rounded-md border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
        isDark ? 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-100' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#F43F5E]" />
            <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Export to Canva Frame</h2>
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

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Overlay Warning / Blocked State */}
          {overlayResult.hasOverlay && (
            <div className={`p-4 rounded border space-y-3 ${
              isDark ? 'border-amber-500/30 bg-amber-950/20 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className={`font-semibold text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                    Export Blocked: Uncombined Overlays Detected
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-amber-200/80' : 'text-amber-700'}`}>
                    Overlays are not allowed when exporting to Canva. Canva
                    Frames require a unified, non-overlapping vector clipping
                    boundary. The following layers currently overlap:
                  </p>
                </div>
              </div>

              {/* Collision List */}
              <div className="max-h-28 overflow-y-auto space-y-1 pl-8 pr-2">
                {overlayResult.collisions.map((c, idx) => (
                  <div
                    key={idx}
                    className={`text-xs rounded px-2.5 py-1 flex items-center justify-between border ${
                      isDark ? 'bg-amber-900/30 border-amber-800/50 text-amber-100' : 'bg-white border-amber-200 text-amber-800'
                    }`}
                  >
                    <span>
                      <strong>{c.layer1Name}</strong> ✕{' '}
                      <strong>{c.layer2Name}</strong>
                    </span>
                    <span className="text-[10px] text-amber-500 font-mono">
                      Overlapping
                    </span>
                  </div>
                ))}
              </div>

              {/* Flatten First Option */}
              <div className={`pt-2 border-t flex items-center justify-between ${
                isDark ? 'border-amber-500/20' : 'border-amber-200'
              }`}>
                <span className={`text-xs ${isDark ? 'text-amber-200/90' : 'text-amber-800'}`}>
                  Combine all overlapping shapes into a single unified frame:
                </span>
                <button
                  type="button"
                  onClick={onFlattenFirst}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-gradient-to-r from-[#F43F5E] to-[#FF5722] hover:opacity-90 text-white font-semibold text-xs transition-opacity shadow-sm cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  Flatten First & Unlock Export
                </button>
              </div>
            </div>
          )}

          {/* Canva Minimum Import Size — the export is cropped to the artwork,
              so a thin shape makes a page Canva refuses to import. */}
          {sizeCheck.status === 'tooSmall' && (
            <div className={`p-4 rounded border space-y-3 ${
              isDark ? 'border-rose-500/30 bg-rose-950/20 text-rose-200' : 'border-rose-300 bg-rose-50 text-rose-900'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className={`font-semibold text-sm ${isDark ? 'text-rose-300' : 'text-rose-800'}`}>
                    Import Will Fail: Frame Is Too Small for Canva
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-rose-200/80' : 'text-rose-700'}`}>
                    The export is cropped to the artwork, not to the canvas, so this
                    file is a{' '}
                    <span className="font-mono font-semibold">
                      {sizeCheck.width} × {sizeCheck.height} px
                    </span>{' '}
                    page. Its shortest side is{' '}
                    <span className="font-mono font-semibold">{sizeCheck.smallestSide} px</span>,
                    under Canva’s {sizeCheck.minimum} px minimum — Canva will reject the
                    upload with “The dimensions of this document are too small to import.”
                  </p>
                </div>
              </div>

              <div className={`text-xs leading-relaxed rounded px-3 py-2 border ${
                isDark ? 'bg-rose-900/25 border-rose-800/50 text-rose-100' : 'bg-white border-rose-200 text-rose-800'
              }`}>
                <strong>Fix:</strong> scale the frame up about{' '}
                <span className="font-mono">{sizeCheck.suggestedScale}×</span> — to roughly{' '}
                <span className="font-mono">
                  {sizeCheck.suggestedWidth} × {sizeCheck.suggestedHeight} px
                </span>{' '}
                — using the W/H fields in the Properties panel, then export again. If this
                frame is one piece of a set, scale every piece by the same factor so they
                still line up once they are back in Canva.
              </div>

              <div className={`pt-2 border-t flex items-center justify-between gap-3 ${
                isDark ? 'border-rose-500/20' : 'border-rose-200'
              }`}>
                <span className={`text-xs ${isDark ? 'text-rose-200/90' : 'text-rose-800'}`}>
                  Downloading is blocked because Canva is very unlikely to accept this file.
                </span>
                <button
                  type="button"
                  onClick={() => setSizeOverride(true)}
                  disabled={sizeOverride}
                  className={`shrink-0 px-4 py-2 rounded text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                    isDark ? 'bg-[#242424] hover:bg-[#2E2E2E] text-rose-200 border-rose-800/60' : 'bg-white hover:bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  {sizeOverride ? 'Export Unlocked' : 'Export Anyway'}
                </button>
              </div>
            </div>
          )}

          {sizeCheck.status === 'tight' && (
            <div className={`p-3.5 rounded border flex items-start gap-3 ${
              isDark ? 'border-amber-500/30 bg-amber-950/20 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}>
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className={`font-semibold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                  Small Frame — Import Will Be Tight
                </span>{' '}
                — this exports as a{' '}
                <span className="font-mono font-semibold">
                  {sizeCheck.width} × {sizeCheck.height} px
                </span>{' '}
                page, only just clear of Canva’s {sizeCheck.minimum} px minimum. It should
                import, but the frame arrives tiny and awkward to place. Scaling up to about{' '}
                <span className="font-mono">
                  {sizeCheck.suggestedWidth} × {sizeCheck.suggestedHeight} px
                </span>{' '}
                gives it room.
              </div>
            </div>
          )}

          {!overlayResult.hasOverlay &&
            (sizeCheck.status === 'ok' || sizeCheck.status === 'empty') && (
            <div className={`p-3.5 rounded border flex items-center gap-3 ${
              isDark ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
            }`}>
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="text-xs">
                <span className={`font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                  Ready for Canva Export
                </span>{' '}
                — No uncombined overlays detected, and the{' '}
                <span className="font-mono">
                  {sizeCheck.width} × {sizeCheck.height} px
                </span>{' '}
                page clears Canva’s {sizeCheck.minimum} px minimum. Vector frame geometry is clean.
              </div>
            </div>
          )}

          {/* Export Formats */}
          <div className="space-y-3">
            <div className={`flex items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-wider ${
              isDark ? 'text-neutral-400' : 'text-gray-500'
            }`}>
              <span>Select Export Format for Canva</span>
              {/* The size that decides whether Canva accepts the upload, shown
                  before the download rather than after the rejection. */}
              <span
                title="Exported page size — the artwork's bounding box, not the canvas"
                className={
                  sizeCheck.status === 'tooSmall'
                    ? isDark ? 'text-rose-400 normal-case' : 'text-rose-600 normal-case'
                    : sizeCheck.status === 'tight'
                    ? isDark ? 'text-amber-400 normal-case' : 'text-amber-600 normal-case'
                    : 'normal-case'
                }
              >
                {sizeCheck.width} × {sizeCheck.height} px
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Native Canva PDF Frame (Recommended) */}
              <div
                className={`p-4 rounded border transition-all ${
                  exportBlocked
                    ? isDark ? 'opacity-40 border-[#2A2A2A] bg-[#1E1E1E] pointer-events-none' : 'opacity-40 border-gray-200 bg-gray-50 pointer-events-none'
                    : isDark
                    ? 'border-[#F43F5E]/50 bg-[#F43F5E]/5 hover:border-[#F43F5E]'
                    : 'border-[#F43F5E]/60 bg-[#F43F5E]/5 hover:border-[#F43F5E]'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#F43F5E]" />
                    <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Canva Frame PDF
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium border ${
                    isDark ? 'bg-[#F43F5E]/15 text-[#FB7185] border-[#F43F5E]/30' : 'bg-[#F43F5E]/15 text-[#E11D48] border-[#F43F5E]/40'
                  }`}>
                    Native Canva
                  </span>
                </div>
                <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                  The standard method to create a Canva Frame: Canva automatically
                  converts this vector PDF clipping path into a native drag-and-drop
                  Frame when uploaded.
                </p>
                <button
                  type="button"
                  disabled={exportBlocked || isExportingPdf}
                  onClick={handleDownloadPdf}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded bg-gradient-to-r from-[#F43F5E] to-[#FF5722] hover:opacity-90 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition-opacity cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {isExportingPdf ? 'Generating PDF...' : 'Download Canva Frame PDF'}
                </button>
              </div>

              {/* Option 2: Canva Frame SVG */}
              <div
                className={`p-4 rounded border transition-all ${
                  exportBlocked
                    ? isDark ? 'opacity-40 border-[#2A2A2A] bg-[#1E1E1E] pointer-events-none' : 'opacity-40 border-gray-200 bg-gray-50 pointer-events-none'
                    : isDark
                    ? 'border-[#2A2A2A] bg-[#242424]/40 hover:border-[#383838]'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className={`w-5 h-5 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`} />
                    <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Canva Frame SVG
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium border ${
                    isDark ? 'bg-[#2A2A2A] text-neutral-300 border-transparent' : 'bg-gray-200 text-gray-700 border-gray-300'
                  }`}>
                    Vector Mask
                  </span>
                </div>
                <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                  Vector SVG formatted with clipPath and Canva Frame rolling hills &
                  sky placeholder. Compatible with Canva uploads and web vector apps.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={exportBlocked}
                    onClick={handleDownloadSvg}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                      isDark ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-200 border-[#2A2A2A]' : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-300'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    Download SVG
                  </button>
                  <button
                    type="button"
                    disabled={exportBlocked}
                    onClick={handleCopySvg}
                    className={`px-3 py-2.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                      isDark ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-200 border-[#2A2A2A]' : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-300'
                    }`}
                    title="Copy SVG Code"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copied && (
                  <div className={`text-[11px] text-center mt-1.5 font-mono ${
                    isDark ? 'text-[#FB7185]' : 'text-[#E11D48]'
                  }`}>
                    SVG code copied to clipboard!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Canva Import Instructions */}
          <div className={`p-4 rounded border space-y-3 ${
            isDark ? 'bg-[#242424]/40 border-[#2A2A2A]' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 text-xs font-semibold ${
                isDark ? 'text-neutral-300' : 'text-gray-700'
              }`}>
                <HelpCircle className="w-4 h-4 text-[#FF5722]" />
                How to use your custom Frame in Canva.com
              </div>
              <a
                href="https://www.canva.com/upload"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-[#F43F5E] hover:text-[#FF5722] font-medium"
              >
                Open Canva Uploads
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <ol className={`text-xs space-y-1.5 list-decimal list-inside leading-relaxed font-sans ${
              isDark ? 'text-neutral-400' : 'text-gray-600'
            }`}>
              <li>
                Click <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>Download Canva Frame PDF</strong> above.
              </li>
              <li>
                Go to <span className={`font-mono ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>canva.com</span> and open any design (or click <em>Upload files</em>).
              </li>
              <li>
                Drag and drop your exported PDF into Canva’s left sidebar under <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>Uploads</strong>.
              </li>
              <li>
                Click the uploaded frame to add it to your Canva design.
              </li>
              <li>
                Drag any photo or video from Canva right onto your shape — it will snap inside as a native Canva Frame!
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end px-6 py-4 border-t ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2 text-xs font-medium rounded border transition-colors ${
              isDark ? 'bg-[#242424] hover:bg-[#2E2E2E] text-neutral-300 border-[#2A2A2A]' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
