import { useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { tabs as tabsApi } from '@/lib/api';

export function FindBar() {
  const { find, setFindQuery, closeFind, activeTabId } = useBrowser();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (find.open) inputRef.current?.focus();
  }, [find.open]);

  if (!find.open) return null;

  return (
    <div className="animate-fade-in absolute right-4 top-24 z-30 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 shadow-xl">
      <input
        ref={inputRef}
        value={find.query}
        onChange={(e) => setFindQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (activeTabId) void tabsApi.findNext(activeTabId, find.query, !e.shiftKey);
          } else if (e.key === 'Escape') {
            closeFind();
          }
        }}
        placeholder="Find in page"
        className="h-7 w-56 bg-transparent text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] outline-none"
        aria-label="Find in page"
      />
      <span className="min-w-[52px] text-center text-[11px] tabular-nums text-[var(--color-text-subtle)]">
        {find.matches > 0 ? `${find.activeMatch}/${find.matches}` : 'No results'}
      </span>
      <button
        type="button"
        aria-label="Previous match"
        onClick={() => activeTabId && void tabsApi.findNext(activeTabId, find.query, false)}
        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]"
      >
        <ChevronUp size={15} />
      </button>
      <button
        type="button"
        aria-label="Next match"
        onClick={() => activeTabId && void tabsApi.findNext(activeTabId, find.query, true)}
        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]"
      >
        <ChevronDown size={15} />
      </button>
      <button
        type="button"
        aria-label="Close find bar"
        onClick={closeFind}
        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]"
      >
        <X size={15} />
      </button>
    </div>
  );
}
