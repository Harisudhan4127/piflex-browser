'use strict';

const MAX_BOOKMARKS = 5000;

function isValidBookmarkUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:', 'file:', 'ftp:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function cleanFolder(value, fallback = 'Bookmarks bar') {
  const folder = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 100);
  return folder || fallback;
}

function normalizeRow(row) {
  return {
    id: row.id,
    title: row.title || row.url,
    url: row.url,
    folder: row.folder,
    created: row.created,
    updated: row.updated,
  };
}

class BookmarkService {
  constructor(db) {
    this.db = db;
  }

  list() {
    if (!this.db.available) return [];
    return this.db
      .prepare('SELECT * FROM bookmarks ORDER BY folder ASC, position ASC, created ASC')
      .all()
      .map(normalizeRow);
  }

  folders() {
    if (!this.db.available) return [];
    return this.db
      .prepare('SELECT DISTINCT folder FROM bookmarks ORDER BY folder COLLATE NOCASE ASC')
      .pluck()
      .all();
  }

  find(url) {
    if (!this.db.available) return null;
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE url = ?').get(url);
    return row ? normalizeRow(row) : null;
  }

  contains(url) {
    return !!this.find(url);
  }

  add({ title, url, folder }) {
    if (!this.db.available || !isValidBookmarkUrl(url)) return null;
    const existing = this.find(url);
    const now = Date.now();
    if (existing) {
      this.db
        .prepare('UPDATE bookmarks SET title = @title, folder = @folder, updated = @now WHERE id = @id')
        .run({
          id: existing.id,
          title: String(title || existing.title).slice(0, 300),
          folder: cleanFolder(folder || existing.folder),
          now,
        });
      return this.find(url);
    }
    const count = this.db.prepare('SELECT COUNT(*) FROM bookmarks').pluck().get();
    if (count >= MAX_BOOKMARKS) return null;
    const maxPos = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) FROM bookmarks WHERE folder = ?')
      .pluck()
      .get(cleanFolder(folder));
    const id = `b-${now}-${Math.random().toString(36).slice(2, 8)}`;
    this.db
      .prepare(
        `INSERT INTO bookmarks (id, title, url, folder, position, created, updated)
         VALUES (@id, @title, @url, @folder, @position, @now, @now)`,
      )
      .run({
        id,
        title: String(title || url).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) || url,
        url: String(url).slice(0, 4096),
        folder: cleanFolder(folder),
        position: maxPos + 1,
        now,
      });
    return this.find(url);
  }

  update(id, patch = {}) {
    if (!this.db.available) return null;
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
    if (!row) return null;
    const next = {
      id,
      title: patch.title !== undefined ? String(patch.title || row.url).slice(0, 300) : row.title,
      url: row.url,
      folder: patch.folder !== undefined ? cleanFolder(patch.folder) : row.folder,
      updated: Date.now(),
    };
    if (patch.url !== undefined && patch.url !== row.url) {
      if (!isValidBookmarkUrl(patch.url) || this.find(String(patch.url))) return null;
      next.url = String(patch.url).slice(0, 4096);
    }
    this.db
      .prepare('UPDATE bookmarks SET title=@title, url=@url, folder=@folder, updated=@updated WHERE id=@id')
      .run(next);
    return this.find(next.url);
  }

  remove(id) {
    if (!this.db.available) return false;
    return this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id).changes > 0;
  }

  move(id, folder, position) {
    if (!this.db.available) return false;
    return (
      this.db
        .prepare('UPDATE bookmarks SET folder = @folder, position = @position, updated = @now WHERE id = @id')
        .run({ id, folder: cleanFolder(folder), position: Number(position) || 0, now: Date.now() })
        .changes > 0
    );
  }

  search(query = '') {
    const q = String(query || '').toLowerCase().trim();
    const all = this.list();
    if (!q) return all;
    return all.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        b.folder.toLowerCase().includes(q),
    );
  }

  importItems(items) {
    if (!this.db.available || !Array.isArray(items)) return 0;
    let added = 0;
    const tx = this.db.transaction(() => {
      for (const item of items.slice(0, MAX_BOOKMARKS)) {
        if (!item || !isValidBookmarkUrl(item.url)) continue;
        if (this.find(String(item.url))) continue;
        if (this.add({ title: item.title, url: item.url, folder: item.folder })) added += 1;
      }
    });
    tx();
    return added;
  }

  exportItems() {
    return this.list();
  }

  clear() {
    if (!this.db.available) return;
    this.db.prepare('DELETE FROM bookmarks').run();
  }
}

module.exports = { BookmarkService, MAX_BOOKMARKS, cleanFolder, isValidBookmarkUrl };
