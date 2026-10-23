import { useEffect, useMemo, useState } from 'react';
import { Star, Search, Trash2, Pencil, FolderPlus, Plus, ExternalLink, Folder } from 'lucide-react';
import { InternalPageLayout, PageEmpty } from '@/components/InternalPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { bookmarks as bookmarksApi } from '@/lib/api';
import { useBrowser } from '@/store/browser-store';
import { cn, hostOf } from '@/lib/utils';
import type { Bookmark } from '@shared/types';

export function BookmarksPage() {
  const { refreshBookmarks } = useBrowser();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const load = () => void bookmarksApi.list().then(setItems).catch(() => undefined);
  useEffect(load, []);

  const folders = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of items) map.set(b.folder, (map.get(b.folder) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((b) => {
      if (folder && b.folder !== folder) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        b.folder.toLowerCase().includes(q)
      );
    });
  }, [items, query, folder]);

  const open = (url: string) => {
    const state = useBrowser.getState();
    if (state.activeTabId) void state.navigate(state.activeTabId, url);
    else void state.createTab(url);
  };

  const remove = async (id: string) => {
    await bookmarksApi.remove(id).catch(() => undefined);
    load();
    void refreshBookmarks();
  };

  const saveTitle = async (id: string) => {
    await bookmarksApi.update(id, { title: editTitle }).catch(() => undefined);
    setEditing(null);
    load();
    void refreshBookmarks();
  };

  const exportBookmarks = async () => {
    const data = await bookmarksApi.exportItems().catch(() => []);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'piflex-bookmarks.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const list = Array.isArray(parsed) ? parsed : parsed.bookmarks;
        if (Array.isArray(list)) {
          await bookmarksApi.importItems(list).catch(() => 0);
          load();
          void refreshBookmarks();
        }
      } catch {
        // ignore malformed import
      }
    };
    input.click();
  };

  return (
    <InternalPageLayout
      page="bookmarks"
      title="Bookmarks"
      subtitle={`${items.length} saved`}
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={importFile}>
            Import
          </Button>
          <Button size="sm" variant="secondary" onClick={exportBookmarks} disabled={items.length === 0}>
            Export
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bookmarks"
            className="pl-8"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFolder(null)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition-colors',
            folder === null
              ? 'bg-[var(--color-accent-soft)] text-accent'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]',
          )}
        >
          <FolderPlus size={13} /> All ({items.length})
        </button>
        {folders.map(([name, count]) => (
          <button
            key={name}
            type="button"
            onClick={() => setFolder(name)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition-colors',
              folder === name
                ? 'bg-[var(--color-accent-soft)] text-accent'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]',
            )}
          >
            <Folder size={13} /> {name} ({count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <PageEmpty
          title={items.length === 0 ? 'No bookmarks yet' : 'No matches'}
          hint={items.length === 0 ? 'Star a page or add a bookmark to see it here.' : 'Try a different search.'}
        />
      ) : (
        <ul className="space-y-1">
          {filtered.map((b) => (
            <li
              key={b.id}
              className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]"
            >
              <Star size={14} className="shrink-0 text-accent" fill="currentColor" />
              <div className="min-w-0 flex-1">
                {editing === b.id ? (
                  <Input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => void saveTitle(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveTitle(b.id);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    className="h-7"
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => open(b.url)}
                      className="block max-w-full truncate text-left text-[13px] text-[var(--color-text)] hover:text-accent"
                    >
                      {b.title}
                    </button>
                    <div className="truncate text-[11px] text-[var(--color-text-subtle)]">
                      {hostOf(b.url)} · {b.folder}
                    </div>
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="icon-sm" variant="ghost" aria-label="Open" onClick={() => open(b.url)}>
                  <ExternalLink size={14} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Rename"
                  onClick={() => {
                    setEditing(b.id);
                    setEditTitle(b.title);
                  }}
                >
                  <Pencil size={14} />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => void remove(b.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <span className="hidden">
        <Plus size={1} />
      </span>
    </InternalPageLayout>
  );
}
