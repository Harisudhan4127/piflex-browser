import { useState } from 'react';
import { Folder, Pencil, Star, Trash2 } from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { bookmarks as bookmarksApi } from '@/lib/api';
import { hostOf } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { Bookmark } from '@shared/types';

/**
 * Bookmarks bar shown beneath the address bar. Renders bookmarks in the
 * "Bookmarks bar" folder; the full manager lives on piflex://bookmarks.
 */
function BookmarkItem({ bookmark }: { bookmark: Bookmark }) {
  const { createTab, refreshBookmarks } = useBrowser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(bookmark.title);

  const open = () => void createTab(bookmark.url);

  const save = async () => {
    const next = title.trim() || bookmark.title || hostOf(bookmark.url);
    if (next !== bookmark.title) {
      await bookmarksApi.update(bookmark.id, { title: next }).catch(() => undefined);
      await refreshBookmarks();
    }
    setEditing(false);
    setMenuOpen(false);
  };

  const remove = async () => {
    await bookmarksApi.remove(bookmark.id).catch(() => undefined);
    await refreshBookmarks();
    setMenuOpen(false);
  };

  return (
    <div className="relative shrink-0">
      {editing ? (
        <div className="flex items-center">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
              if (e.key === 'Escape') {
                setTitle(bookmark.title);
                setEditing(false);
              }
            }}
            className="h-6 w-40 px-2 text-[12px]"
          />
        </div>
      ) : (
        <button
          type="button"
          title={bookmark.url}
          onClick={open}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen((value) => !value);
          }}
          className="flex max-w-[160px] items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
        >
          <Star size={11} className="shrink-0 text-accent" fill="currentColor" />
          <span className="truncate">{bookmark.title || hostOf(bookmark.url)}</span>
        </button>
      )}
      {menuOpen && !editing ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
            onClick={() => {
              setTitle(bookmark.title);
              setEditing(true);
              setMenuOpen(false);
            }}
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
            onClick={open}
          >
            <Folder size={12} /> Open
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
            onClick={() => void remove()}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BookmarkBar() {
  const { bookmarks, createTab } = useBrowser();
  const items = bookmarks.filter((b) => b.folder === 'Bookmarks bar');

  return (
    <div className="no-drag flex h-7 items-center gap-0.5 overflow-x-auto px-2">
      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => void createTab('piflex://bookmarks')}
          className="shrink-0 rounded-md px-2 py-1 text-[12px] text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
        >
          Bookmark this page to see it here
        </button>
      ) : (
        items.map((b) => <BookmarkItem key={b.id} bookmark={b} />)
      )}
    </div>
  );
}
