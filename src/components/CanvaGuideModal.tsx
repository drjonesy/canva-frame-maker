import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { ExternalLink, HelpCircle, X, Play, Upload, Download } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** The walkthrough video, embedded rather than linked so it plays in place. */
const VIDEO_ID = 'IS1ks_hMpP0';

/** A numbered instruction with a short title and a one-line explanation. */
const Step: React.FC<{ n: number; title: string; children: React.ReactNode; isDark: boolean }> = ({
  n,
  title,
  children,
  isDark,
}) => (
  <li className="flex gap-3">
    <span
      className={`shrink-0 w-5 h-5 mt-px rounded-full flex items-center justify-center text-[10px] font-semibold font-mono ${
        isDark ? 'bg-[#242424] text-[#FB7185]' : 'bg-gray-100 text-[#E11D48]'
      }`}
    >
      {n}
    </span>
    <span>
      <strong className={isDark ? 'text-neutral-100' : 'text-gray-900'}>{title}</strong>{' '}
      <span className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{children}</span>
    </span>
  </li>
);

/** A key cap, for the tool shortcuts. */
const Key: React.FC<{ children: React.ReactNode; isDark: boolean }> = ({ children, isDark }) => (
  <kbd
    className={`px-1.5 py-0.5 rounded border font-mono text-[10px] leading-none ${
      isDark
        ? 'bg-[#121212] border-[#2A2A2A] text-neutral-300'
        : 'bg-gray-100 border-gray-300 text-gray-700'
    }`}
  >
    {children}
  </kbd>
);

export const CanvaGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();
  if (!isOpen) return null;

  const sectionHeading = `text-sm font-semibold flex items-center gap-2 ${
    isDark ? 'text-white' : 'text-gray-900'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className={`w-full max-w-3xl rounded-md border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
          isDark ? 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-100' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#F43F5E]" />
            <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              How to Use Canva Frame Maker
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-[#242424] text-neutral-400 hover:text-neutral-200'
                : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div
          className={`p-6 space-y-6 overflow-y-auto text-xs leading-relaxed ${
            isDark ? 'text-neutral-300' : 'text-gray-600'
          }`}
        >
          {/* Walkthrough video */}
          <div className="space-y-2">
            <h3 className={sectionHeading}>
              <Play className="w-4 h-4 text-[#F43F5E]" />
              Watch the walkthrough
            </h3>
            <div
              className={`relative w-full rounded overflow-hidden border aspect-video ${
                isDark ? 'border-[#2A2A2A] bg-black' : 'border-gray-200 bg-black'
              }`}
            >
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`}
                title="Canva Frame Maker walkthrough"
                loading="lazy"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${VIDEO_ID}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[#F43F5E] hover:text-[#FF5722] font-medium"
            >
              Watch on YouTube
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Getting started */}
          <div className="space-y-3">
            <h3 className={sectionHeading}>
              <Upload className="w-4 h-4 text-[#FF5722]" />
              Start a frame
            </h3>
            <ol className="space-y-2 font-sans">
              <Step n={1} title="Bring in artwork." isDark={isDark}>
                Use <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>File → Start from Image</strong>,
                drop a file straight onto the canvas, or paste a copied image with{' '}
                <Key isDark={isDark}>Ctrl/⌘+V</Key>. PNG, JPG and WEBP go through the tracer, which turns
                them into editable vector outlines; SVGs come in as vectors already. Or begin with{' '}
                <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>New Blank Project</strong> and set
                your own canvas size.
              </Step>
              <Step n={2} title="Draw or add shapes." isDark={isDark}>
                The left rail holds the tools: <Key isDark={isDark}>Q</Key> select and move,{' '}
                <Key isDark={isDark}>W</Key> sub-select points and handles, <Key isDark={isDark}>E</Key> pen,{' '}
                <Key isDark={isDark}>A</Key> add an anchor to an existing outline, <Key isDark={isDark}>S</Key> the
                built-in shapes, <Key isDark={isDark}>T</Key> text, <Key isDark={isDark}>M</Key> mirror and{' '}
                <Key isDark={isDark}>P</Key> parallel to a guide.
              </Step>
              <Step n={3} title="Shape it." isDark={isDark}>
                The panels on the right align and distribute layers, combine them with union, subtract and
                intersect, place guides to snap against, and reorder everything in{' '}
                <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>Layers</strong>. Text layers stay
                editable in the <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>Fonts</strong> tab
                until you change their geometry by hand.
              </Step>
              <Step n={4} title="Check the status light." isDark={isDark}>
                The badge in the top bar turns amber when overlapping layers would break the frame. Click it to
                see what needs combining before you export.
              </Step>
              <Step n={5} title="Save your work." isDark={isDark}>
                <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>Save Project</strong>{' '}
                (<Key isDark={isDark}>Ctrl/⌘+S</Key>) writes a <span className="font-mono">.cf.json</span> file you
                can reopen later with <Key isDark={isDark}>Ctrl/⌘+O</Key>. Undo is{' '}
                <Key isDark={isDark}>Ctrl/⌘+Z</Key>.
              </Step>
            </ol>
          </div>

          {/* Export to Canva */}
          <div
            className={`space-y-3 p-4 rounded border ${
              isDark ? 'bg-[#242424]/40 border-[#2A2A2A]' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <h3
              className={`text-sm font-semibold flex items-center gap-2 ${
                isDark ? 'text-[#FB7185]' : 'text-[#E11D48]'
              }`}
            >
              <Download className="w-4 h-4 text-[#FF5722]" />
              Get it into Canva
            </h3>
            <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>
              A <strong className={isDark ? 'text-neutral-200' : 'text-gray-900'}>Frame</strong> in Canva is a
              placeholder shape: drop any photo or video onto it and the media scales, crops and clips to the
              outline you drew.
            </p>
            <ol className="space-y-2 font-sans">
              <Step n={1} title="Export." isDark={isDark}>
                Click <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>Export Canva Frame</strong>,
                then <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>Download Canva Frame PDF</strong>.
              </Step>
              <Step n={2} title="Upload." isDark={isDark}>
                In Canva, open your design and drag the PDF into{' '}
                <strong className={isDark ? 'text-neutral-200' : 'text-gray-800'}>Uploads</strong>. Canva reads the
                vector clipping path and registers it as a native Frame.
              </Step>
              <Step n={3} title="Use it." isDark={isDark}>
                Place the frame on your design and drag any photo into it.
              </Step>
            </ol>
          </div>

          {/* Footer */}
          <div
            className={`pt-3 flex justify-between items-center border-t ${
              isDark ? 'border-[#2A2A2A]' : 'border-gray-200'
            }`}
          >
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
