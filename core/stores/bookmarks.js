'use strict';

const { JsonStore } = require('./json-store');

const MAX_BOOKMARKS = 5000;

function cleanFolder(value, fallback = 'Unsorted') {
  const folder = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 100);
  return folder || fallback;
}

function isValidBookmarkUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:', 'file:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function normalizeBookmark(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidBookmarkUrl(raw.url)) return null;
  const title = String(raw.title || raw.url || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
  return {
    id: String(raw.id || `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 80),
    title: title || String(raw.url).slice(0, 300),
    url: String(raw.url).slice(0, 4096),
    folder: cleanFolder(raw.folder),
    created: Number(raw.created) || Date.now(),
    updated: Number(raw.updated) || Number(raw.created) || Date.now(),
  };
}

function normalizeList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const bookmark = normalizeBookmark(item);
    if (!bookmark || seen.has(bookmark.url)) continue;
    seen.add(bookmark.url);
    out.push(bookmark);
    if (out.length >= MAX_BOOKMARKS) break;
  }
  return out;
}

class BookmarkStore extends JsonStore {
  constructor(filePath, options = {}) {
    super(filePath, {
      defaultValue: [],
      debounceMs: 100,
      legacyPaths: options.legacyPaths || [],
      sanitize: normalizeList,
    });
  }

  list() {
    return this.data.slice().sort((a, b) => a.created - b.created);
  }

  folders() {
    return [...new Set(this.data.map((bookmark) => bookmark.folder))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  find(url) {
    return this.data.find((bookmark) => bookmark.url === url) || null;
  }

  add({ title, url, folder }) {
    if (!isValidBookmarkUrl(url)) return null;
    const existing = this.find(url);
    if (existing) {
      existing.title = String(title || existing.title).slice(0, 300);
      existing.folder = cleanFolder(folder || existing.folder);
      existing.updated = Date.now();
      this.scheduleSave();
      return existing;
    }
    if (this.data.length >= MAX_BOOKMARKS) return null;
    const item = normalizeBookmark({
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      url,
      folder,
      created: Date.now(),
    });
    if (!item) return null;
    this.data.push(item);
    this.scheduleSave();
    return item;
  }

  update(id, patch = {}) {
    const item = this.data.find((bookmark) => bookmark.id === id);
    if (!item) return null;
    if (patch.url !== undefined && patch.url !== item.url) {
      if (!isValidBookmarkUrl(patch.url) || this.find(String(patch.url))) return null;
      item.url = String(patch.url).slice(0, 4096);
    }
    if (patch.title !== undefined) {
      item.title = String(patch.title || item.url).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) || item.url;
    }
    if (patch.folder !== undefined) item.folder = cleanFolder(patch.folder);
    item.updated = Date.now();
    this.scheduleSave();
    return item;
  }

  remove(id) {
    const before = this.data.length;
    this.data = this.data.filter((bookmark) => bookmark.id !== id);
    if (this.data.length !== before) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  search(query = '') {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return this.list();
    return this.list().filter(
      (bookmark) =>
        bookmark.title.toLowerCase().includes(q) ||
        bookmark.url.toLowerCase().includes(q) ||
        bookmark.folder.toLowerCase().includes(q),
    );
  }

  importItems(items) {
    const merged = normalizeList([...this.data, ...(Array.isArray(items) ? items : [])]);
    const added = Math.max(0, merged.length - this.data.length);
    this.data = merged.slice(0, MAX_BOOKMARKS);
    this.scheduleSave();
    return added;
  }

  exportItems() {
    return this.list();
  }

  clear() {
    this.data = [];
    this.scheduleSave();
  }
}

module.exports = {
  BookmarkStore,
  MAX_BOOKMARKS,
  cleanFolder,
  isValidBookmarkUrl,
  normalizeBookmark,
  normalizeList,
};
