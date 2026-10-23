import { createContext, useContext } from 'react';
import * as React from 'react';
import { useBrowser } from '@/store/browser-store';
import { PiFlexLogo } from '@/components/browser/PiFlexLogo';
import { Star, Clock, Download, KeyRound, Puzzle, Settings, Info, BookOpen, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

type InternalNavId =
  | 'bookmarks'
  | 'history'
  | 'downloads'
  | 'passwords'
  | 'extensions'
  | 'settings'
  | 'help'
  | 'diagnostics'
  | 'about';

const NAV: { id: InternalNavId; label: string; icon: React.ReactNode }[] = [
  { id: 'bookmarks', label: 'Bookmarks', icon: <Star size={15} /> },
  { id: 'history', label: 'History', icon: <Clock size={15} /> },
  { id: 'downloads', label: 'Downloads', icon: <Download size={15} /> },
  { id: 'passwords', label: 'Passwords', icon: <KeyRound size={15} /> },
  { id: 'extensions', label: 'Extensions', icon: <Puzzle size={15} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={15} /> },
  { id: 'help', label: 'Help', icon: <BookOpen size={15} /> },
  { id: 'diagnostics', label: 'Diagnostics', icon: <Activity size={15} /> },
  { id: 'about', label: 'About', icon: <Info size={15} /> },
];

const PageContext = createContext<{ navigate: (id: InternalNavId) => void }>({ navigate: () => {} });
export const useInternalNav = () => useContext(PageContext);

interface InternalPageLayoutProps {
  page: InternalNavId;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  constrain?: boolean;
}

/**
 * Shared chrome for internal pages (bookmarks, history, settings, etc.). These
 * are real pages loaded in a WebContentsView, so they render a lightweight
 * in-page nav that mirrors the browser's own internal pages.
 */
export function InternalPageLayout({
  page,
  title,
  subtitle,
  actions,
  children,
  constrain = true,
}: InternalPageLayoutProps) {
  const navigate = (id: InternalNavId) => {
    const state = useBrowser.getState();
    const target = `piflex://${id}`;
    if (state.activeTabId) void state.navigate(state.activeTabId, target);
    else void state.createTab(target);
  };

  return (
    <PageContext.Provider value={{ navigate }}>
      <div className="flex h-full w-full bg-[var(--color-surface)]">
        <nav className="flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-4 flex items-center gap-2 px-2">
            <PiFlexLogo size={18} />
            <span className="text-[14px] font-semibold text-[var(--color-text)]">PiFlex</span>
          </div>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                item.id === page
                  ? 'bg-[var(--color-surface-overlay)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]/60 hover:text-[var(--color-text)]',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-6">
            <div>
              <h1 className="text-base font-semibold text-[var(--color-text)]">{title}</h1>
              {subtitle ? <p className="text-[12px] text-[var(--color-text-subtle)]">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className={cn(constrain ? 'mx-auto max-w-3xl px-6 py-6' : 'h-full')}>{children}</div>
          </div>
        </div>
      </div>
    </PageContext.Provider>
  );
}

export function PageEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <div className="text-[14px] font-medium text-[var(--color-text)]">{title}</div>
      {hint ? <div className="max-w-sm text-[12px] text-[var(--color-text-subtle)]">{hint}</div> : null}
    </div>
  );
}
