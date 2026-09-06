import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Props {
  title: string;
  icon?: React.ReactNode;
  /** Small note or count shown on the right of the header. */
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * One block in the right column: a header that toggles its body.
 *
 * The body is unmounted while collapsed rather than hidden, so a long layer
 * list does not keep contributing to the column's scroll height.
 */
export const CollapsibleSection: React.FC<Props> = ({
  title,
  icon,
  badge,
  defaultOpen = true,
  children,
}) => {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border-b ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors cursor-pointer ${
          isDark ? 'hover:bg-[#242424]' : 'hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon}
          <span
            className={`text-xs font-semibold uppercase tracking-wider truncate ${
              isDark ? 'text-neutral-300' : 'text-gray-700'
            }`}
          >
            {title}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {badge}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'} ${
              isDark ? 'text-neutral-500' : 'text-gray-400'
            }`}
          />
        </span>
      </button>

      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};
