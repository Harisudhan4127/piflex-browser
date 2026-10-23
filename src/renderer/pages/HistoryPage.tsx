import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Clock, XCircle } from 'lucide-react';
import { InternalPageLayout, PageEmpty } from '@/components/InternalPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { history as historyApi } from '@/lib/api';
import { useBrowser } from '@/store/browser-store';
import { contextMenu } from '@/lib/context-menu';
import { cn, hostOf, groupHistoryByDay } from '@/lib/utils';
import type { HistoryEntry } from '@shared/types';

export function HistoryPage() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);

  const load = () => void historyApi.list(0, 2000).then(setItems).catch(() => undefined);
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q),
    );
  }, [items, query]);

  const groups = useMemo(() => groupHistoryByDay(filtered), [filtered]);

  const open = (url: string) => {
    const state = useBrowser.getState();
    if (state.activeTabId) void state.navigate(state.activeTabId, url);
    else void state.createTab(url);
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeSelected = async () => {
    if (selected.size === 0) return;
    await historyApi.remove([...selected]).catch(() => undefined);
    setSelected(new Set());
    load();
  };

  const clearAll = async () => {
    await historyApi.clear(0).catch(() => undefined);
    setConfirmClear(false);
    load();
  };

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'piflex-history.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <InternalPageLayout
      page="history"
      title="History"
      subtitle={`${items.length} entries`}
      actions={
        <>
          {selected.size > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => void removeSelected()}>
              <Trash2 size={13} /> Delete {selected.size}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={exportHistory} disabled={filtered.length === 0}>
            Export
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} disabled={items.length === 0}>
            Clear all
          </Button>
        </>
      }
    >
      {confirmClear ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2.5">
          <span className="text-[13px] text-[var(--color-text)]">
            Delete all browsing history? This cannot be undone.
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={() => void clearAll()}>
              Delete all
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative mb-4">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search history"
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <PageEmpty
          title={items.length === 0 ? 'No history yet' : 'No matches'}
          hint={items.length === 0 ? 'Pages you visit will appear here.' : 'Try a different search.'}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                {group.label}
              </h2>
              <ul className="space-y-0.5">
                {group.items.map((h) => (
                  <li
                    key={h.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      void contextMenu(e, [
                        { label: 'Open', onClick: () => open(h.url) },
                        { label: 'Open in new tab', onClick: () => void useBrowser.getState().createTab(h.url) },
                        { label: 'Copy link', onClick: () => void navigator.clipboard.writeText(h.url) },
                        { separator: true },
                        { label: 'Delete', danger: true, onClick: () => void historyApi.remove([h.id]).then(load) },
                      ]);
                    }}
                    className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-1.5 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(h.id)}
                      onChange={() => toggle(h.id)}
                      className="accent-[var(--color-accent)]"
                      aria-label={`Select ${h.title}`}
                    />
                    <Clock size={13} className="shrink-0 text-[var(--color-text-subtle)]" />
                    <button type="button" onClick={() => open(h.url)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[13px] text-[var(--color-text)]">{h.title || h.url}</div>
                      <div className="truncate text-[11px] text-[var(--color-text-subtle)]">
                        {hostOf(h.url)} · {new Date(h.lastVisit).toLocaleTimeString()}
                        {h.visitCount > 1 ? ` · ${h.visitCount} visits` : ''}
                      </div>
                    </button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete entry"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => void historyApi.remove([h.id]).then(load)}
                    >
                      <XCircle size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <span className={cn('hidden')}>
        <Trash2 size={1} />
      </span>
    </InternalPageLayout>
  );
}
