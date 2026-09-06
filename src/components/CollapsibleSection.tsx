import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Props {
  title: string;
  icon?: React.ReactNode;
  /** Small note or count shown on the right of the header. */
  badge?: React.ReactNode;
  /**
   * Controls sitting immediately after the title — a settings gear and the like.
   * Rendered outside the expand/collapse buttons, so clicking one does not
   * toggle the section, and anchored to the header row: a popup in here can
   * position itself `absolute top-full` to hang below the header.
   */
  actions?: React.ReactNode;
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
  actions,
  defaultOpen = true,
  children,
}) => {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  const hover = isDark ? 'hover:bg-[#242424]' : 'hover:bg-gray-50';

  return (
    <div className={`border-b ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`}>
      {/* The header is a row rather than one big button so `actions` can hold
          real buttons: a button inside a button is invalid, and every click in
          there would toggle the section. The two halves that remain both
          toggle, so the whole row minus the actions is still a hit target. */}
      <div className="relative flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex items-center gap-2 min-w-0 pl-4 py-3 text-left transition-colors cursor-pointer ${hover}`}
        >
          {icon}
          <span
            className={`text-xs font-semibold uppercase tracking-wider truncate ${
              isDark ? 'text-neutral-300' : 'text-gray-700'
            }`}
          >
            {title}
          </span>
        </button>

        {actions}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          className={`flex-1 flex items-center justify-end gap-2 pr-4 py-3 transition-colors cursor-pointer ${hover}`}
        >
          {badge}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'} ${
              isDark ? 'text-neutral-500' : 'text-gray-400'
            }`}
          />
        </button>
      </div>

      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};
