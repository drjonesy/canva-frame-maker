import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface SectionTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Small note shown above the body while this tab is the active one. */
  badge?: React.ReactNode;
  content: React.ReactNode;
}

interface Props {
  tabs: SectionTab[];
  defaultTabId?: string;
  defaultOpen?: boolean;
}

/**
 * One block in the right column that holds several panels behind a tab strip.
 *
 * The strip doubles as the block's header: the chevron on its right collapses
 * the body, and picking a tab while collapsed opens it again. Only the active
 * tab's content is mounted — the others, like a collapsed body, contribute
 * nothing to the column's scroll height.
 */
export const TabbedSection: React.FC<Props> = ({
  tabs,
  defaultTabId,
  defaultOpen = true,
}) => {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  if (!active) return null;

  return (
    <div className={`border-b ${isDark ? 'border-[#2A2A2A]' : 'border-gray-200'}`}>
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <div
          role="tablist"
          className={`flex-1 flex items-center gap-0.5 p-0.5 rounded-lg border ${
            isDark ? 'bg-[#141414] border-[#2A2A2A]' : 'bg-gray-100 border-gray-200'
          }`}
        >
          {tabs.map((tab) => {
            const selected = tab.id === active.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setActiveId(tab.id);
                  setOpen(true);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selected
                    ? isDark
                      ? 'bg-[#2E2E2E] text-white shadow-sm'
                      : 'bg-white text-gray-900 shadow-sm'
                    : isDark
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? 'Collapse' : 'Expand'}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark ? 'hover:bg-[#242424]' : 'hover:bg-gray-100'
          }`}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'} ${
              isDark ? 'text-neutral-500' : 'text-gray-400'
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4">
          {active.badge && (
            <div className="flex justify-end mb-2">{active.badge}</div>
          )}
          {active.content}
        </div>
      )}
    </div>
  );
};
