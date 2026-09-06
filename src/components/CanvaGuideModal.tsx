import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { ExternalLink, Sparkles, X, FileText, CheckCircle2, Code } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CanvaGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className={`w-full max-w-2xl rounded-md border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
        isDark ? 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-100' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#F43F5E]" />
            <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>How Canva Frames & SDK Work</h2>
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
        <div className={`p-6 space-y-6 overflow-y-auto text-xs leading-relaxed ${
          isDark ? 'text-neutral-300' : 'text-gray-600'
        }`}>
          {/* Section 1 */}
          <div className="space-y-2">
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-[#F43F5E]" />
              What is a Canva Frame?
            </h3>
            <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>
              In Canva, a <strong className={isDark ? 'text-neutral-200' : 'text-gray-900'}>Frame</strong> is an interactive placeholder shape where users can drop any image or video from their uploads or Canva’s library. The media automatically scales, crops, and clips within the boundary of the frame.
            </p>
          </div>

          {/* Section 2 */}
          <div className={`space-y-2 p-4 rounded border ${
            isDark ? 'bg-[#242424]/40 border-[#2A2A2A]' : 'bg-gray-50 border-gray-200'
          }`}>
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${
              isDark ? 'text-[#FB7185]' : 'text-[#E11D48]'
            }`}>
              <FileText className="w-4 h-4 text-[#FF5722]" />
              How to upload your custom Frame to Canva
            </h3>
            <ol className={`list-decimal list-inside space-y-2 font-sans ${
              isDark ? 'text-neutral-300' : 'text-gray-700'
            }`}>
              <li>
                Click <strong className={isDark ? 'text-neutral-100' : 'text-gray-900'}>Export Canva Frame</strong> and choose <strong className={isDark ? 'text-neutral-100' : 'text-gray-900'}>Download Canva Frame PDF</strong>.
              </li>
              <li>
                In Canva (<a href="https://www.canva.com" target="_blank" rel="noreferrer" className="text-[#F43F5E] hover:underline font-mono">canva.com</a>), open your project or go to <strong className={isDark ? 'text-neutral-100' : 'text-gray-900'}>Uploads</strong>.
              </li>
              <li>
                Drag the downloaded PDF file into Canva. Canva’s PDF ingestion engine detects the vector clipping path and automatically registers it as a native Canva Frame!
              </li>
              <li>
                Click the frame in your Canva design, and drag any photo into it.
              </li>
            </ol>
          </div>

          {/* Section 3: Canva SDK & API */}
          <div className="space-y-2">
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              <Code className="w-4 h-4 text-[#FF5722]" />
              Canva SDK & API Integration
            </h3>
            <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>
              This application is designed to be compatible with Canva’s developer ecosystem:
            </p>
            <div className={`p-3 rounded font-mono text-[11px] border space-y-1 ${
              isDark ? 'bg-[#121212] border-[#2A2A2A] text-neutral-300' : 'bg-gray-100 border-gray-300 text-gray-800'
            }`}>
              <div>// Canva Apps SDK & Connect API Integration ready</div>
              <div>// Output produces Canva-compliant SVG clipPath & PDF vector masks</div>
              <div className={isDark ? 'text-[#FB7185]' : 'text-[#E11D48]'}>
                https://www.canva.dev/docs/apps/
              </div>
            </div>
            <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>
              You can also use the Canva Button API (<code className={`font-mono ${isDark ? 'text-neutral-200' : 'text-gray-900'}`}>https://sdk.canva.com/designbutton/v2/api.js</code>) to embed a direct &quot;Design in Canva&quot; button or upload via the Canva Connect REST API.
            </p>
          </div>

          {/* Quick link */}
          <div className={`pt-3 flex justify-between items-center border-t ${
            isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
          }`}>
            <a
              href="https://www.canva.com/upload"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[#F43F5E] hover:text-[#FF5722] font-medium"
            >
              Open Canva Uploads page
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gradient-to-r from-[#F43F5E] to-[#FF5722] hover:opacity-90 text-white font-semibold text-xs transition-opacity shadow-sm cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
