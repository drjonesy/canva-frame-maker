import React from 'react';

/**
 * A small outlined anchor ring at the bottom left, and a bold plus filling the
 * top right. The Add Anchor tool adds exactly that: one more point on the
 * outline.
 *
 * The plus is two overlapping rounded rectangles rather than a stroked cross —
 * at 16px a stroke heavy enough to read this boldly loses its corners.
 */
export const AddPointIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    {/* The anchor */}
    <circle
      cx="5.1"
      cy="18.6"
      r="2.7"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    />
    {/* The plus */}
    <rect x="12.6" y="1.9" width="5.4" height="14.2" rx="1.3" fill="currentColor" />
    <rect x="8.2" y="6.3" width="14.2" height="5.4" rx="1.3" fill="currentColor" />
  </svg>
);
