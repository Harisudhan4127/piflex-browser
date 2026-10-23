import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Globe,
  Star,
  Lock,
  ShieldAlert,
  ShieldCheck,
  CornerDownLeft,
  Clock,
  Bookmark as BookmarkIcon,
} from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { win } from '@/lib/api';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SecurityState, Suggestion } from '@shared/types';

function SecurityIndicator({ security }: { security: SecurityState }) {
  const icon =
    security.level === 'secure' ? (
      <Lock size={13} />
    ) : security.level === 'insecure' ? (
      <ShieldAlert size={13} />
    ) : security.level === 'internal' || security.level === 'local' ? (
      <ShieldCheck size={13} />
    ) : (
      <Globe size={13} />
    );
  const color =
    security.level === 'secure'
      ? 'text-[var(--color-success)]'
      : security.level === 'insecure'
        ? 'text-[var(--color-warning)]'
        : 'text-[var(--color-text-subtle)]';
  return (
    <Tooltip label={security.label} side="bottom">
      <span className={cn('flex h-7 w-7 items-center justify-center', color)} aria-label={security.label}>
        {icon}
      </span>
    </Tooltip>
  );
}

function suggestionIcon(kind: Suggestion['kind']) {
  if (kind === 'search') return <Search size={14} className="text-[var(--color-text-subtle)]" />;
  if (kind === 'bookmark') return <BookmarkIcon size={14} className="text-accent" />;
  if (kind === 'history') return <Clock size={14} className="text-[var(--color-text-subtle)]" />;
  return <Globe size={14} className="text-[var(--color-text-subtle)]" />;
}

export function AddressBar() {
  const {
    addressValue,
    setAddress,
    suggestions,
    refreshSuggestions,
    commitAddress,
    tabs,
    activeTabId,
    bookmarks,
    toggleBookmark,
  } = useBrowser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const bookmarked = activeTab ? bookmarks.some((b) => b.url === activeTab.url) : false;
  const suggestionsOpen = open && suggestions.length > 0;

  // Suggestions are drawn by the shell and would be covered by the native page
  // view; hide the view only while the dropdown is actually visible.
  useEffect(() => {
    win.setViewVisible(!suggestionsOpen);
    return () => win.setViewVisible(true);
  }, [suggestionsOpen]);

  useEffect(() => {
    const handler = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('piflex:focus-address', handler);
    return () => window.removeEventListener('piflex:focus-address', handler);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open && addressValue.trim()) void refreshSuggestions(addressValue);
      else void refreshSuggestions('');
    }, 90);
    return () => clearTimeout(timer);
  }, [addressValue, open, refreshSuggestions]);

  const display = useMemo(() => {
    if (!activeTab) return addressValue;
    return addressValue;
  }, [activeTab, addressValue]);

  const choose = (s: Suggestion) => {
    setOpen(false);
    setHighlight(-1);
    void commitAddress(s.url);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) choose(suggestions[highlight]);
      else {
        setOpen(false);
        void commitAddress();
      }
    } else if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, h - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative flex-1">
      <div
        className={cn(
          'no-drag flex h-8 items-center gap-1 rounded-lg border bg-[var(--color-surface)] pr-1 transition-colors',
          open ? 'border-accent' : 'border-[var(--color-border)]',
        )}
      >
        {activeTab ? <SecurityIndicator security={activeTab.security} /> : <span className="w-7" />}
        <input
          ref={inputRef}
          value={display}
          onChange={(e) => setAddress(e.target.value)}
          onFocus={(e) => {
            setOpen(true);
            setAddress(addressValue, true);
            e.currentTarget.select();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder="Search the web or enter a URL"
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] outline-none"
          aria-label="Address and search bar"
        />
        {activeTab && !activeTab.url.startsWith('piflex://') ? (
          <Tooltip label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'} side="bottom">
            <button
              type="button"
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
              onClick={() => void toggleBookmark(activeTab.url, activeTab.title)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-surface-overlay)]',
                bookmarked ? 'text-accent' : 'text-[var(--color-text-subtle)]',
              )}
            >
              <Star size={15} fill={bookmarked ? 'currentColor' : 'none'} />
            </button>
          </Tooltip>
        ) : null}
      </div>

      {open && suggestions.length > 0 ? (
        <div
          className="animate-scale-in absolute left-0 right-0 top-9 z-40 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1 shadow-2xl"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s.kind}-${s.url}-${i}`}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                i === highlight ? 'bg-[var(--color-surface-overlay)]' : '',
              )}
            >
              {suggestionIcon(s.kind)}
              <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">{s.title}</span>
              {s.detail ? (
                <span className="shrink-0 text-[11px] text-[var(--color-text-subtle)]">{s.detail}</span>
              ) : null}
              {i === highlight ? <CornerDownLeft size={13} className="shrink-0 text-[var(--color-text-subtle)]" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
