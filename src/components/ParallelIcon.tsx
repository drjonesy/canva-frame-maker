import React from 'react';

/**
 * A solid arrow running into an upright bar — the edge being driven onto the
 * guide it is to run along. Lucide has no icon for it.
 *
 * Everything is filled rather than outlined: at 16px a stroked rectangle this
 * thick closes up into a smudge. The head carries a hairline stroke of its own
 * colour purely to round its corners, matching the bar's `rx`.
 *
 * Its own file because both the tool rail and the Rotate tab draw it.
 */
export const ParallelIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    {/* The edge, on its way over */}
    <rect x="2.8" y="10.2" width="7.2" height="3.6" rx="1" />
    <path
      d="M9 7.4 13.9 12 9 16.6Z"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
    {/* The guide it is being brought parallel to */}
    <rect x="16.6" y="5.8" width="4.4" height="12.4" rx="1.1" />
  </svg>
);
