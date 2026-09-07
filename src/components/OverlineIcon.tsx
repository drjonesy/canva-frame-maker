import React from 'react';

/**
 * Lucide has `Underline` and `Strikethrough` but no overline, so this is drawn
 * to sit beside them: the same weight and geometry as `Underline`, with the
 * rule moved to the top and the letter form turned over to match — an arch
 * under a bar, where underline is a cup over one. Reusing `Underline` rotated
 * would have read as an underline at a glance, which is the one thing the pair
 * has to be told apart by.
 */
export const OverlineIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <line x1="4" y1="4" x2="20" y2="4" />
    <path d="M6 20v-6a6 6 0 0 1 12 0v6" />
  </svg>
);
