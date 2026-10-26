'use strict';

const { hostnameOf, displayHost } = require('../../../core/url');

const MAX_HISTORY = 20000;

function normalizeEntry(row) {
  return {
    id: row.id,
    url: row.url,
    title: row.title || row.url,
    host: row.host,
    visitCount: row.visit_count,
    lastVisit: row.last_visit,
  };
}

/**
 * SQLite-backed browsing history plus derived top-sites, and a small
 * recently-closed table used to re-open tabs.
 */
class HistoryService {
  constructor(db, { enabled = true } = {}) {
    this.db = db;
    this.enabled = enabled;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  record(url, title) {
    if (!this.enabled || !this.db.available) return;
    const clean = String(url || '').trim();
    if (!/^https?:\/\//i.test(clean)) return;
    const host = hostnameOf(clean);
    if (!host) return;
    const now = Date.now();
    const safeTitle = String(title || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
    try {
      this.db
        .prepare(
          `INSERT INTO history (url, title, host, visit_count, first_visit, last_visit)
           VALUES (@url, @title, @host, 1, @now, @now)
           ON CONFLICT(url) DO UPDATE SET
             title = CASE WHEN @title <> '' THEN @title ELSE history.title END,
             visit_count = history.visit_count + 1,
             last_visit = @now`,
        )
        .run({ url: clean.slice(0, 4096), title: safeTitle, host, now });
      this._recordTopSite(host, clean, safeTitle, now);
      this._trim();
    } catch {
      // History must never break navigation.
    }
  }

  _recordTopSite(host, url, title, now) {
    this.db
      .prepare(
        `INSERT INTO top_sites (host, url, title, visits, last_visit, pinned, pinned_index)
         VALUES (@host, @url, @title, 1, @now, 0, 0)
         ON CONFLICT(host) DO UPDATE SET
           visits = top_sites.visits + 1,
           last_visit = @now,
           url = CASE WHEN @url <> '' THEN @url ELSE top_sites.url END,
           title = CASE WHEN @title <> '' THEN @title ELSE top_sites.title END`,
      )
      .run({ host, url, title, now });
  }

  _trim() {
    const count = this.db.prepare('SELECT COUNT(*) FROM history').pluck().get();
    if (count <= MAX_HISTORY) return;
    this.db
      .prepare(
        `DELETE FROM history WHERE id IN (
           SELECT id FROM history ORDER BY last_visit ASC LIMIT @excess
         )`,
      )
      .run({ excess: count - MAX_HISTORY });
  }

  list({ limit = 500, offset = 0, since = 0 } = {}) {
    if (!this.db.available) return [];
    return this.db
      .prepare(
        `SELECT * FROM history WHERE last_visit >= @since
         ORDER BY last_visit DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ limit, offset, since })
      .map(normalizeEntry);
  }

  search(query, { limit = 100 } = {}) {
    if (!this.db.available) return [];
    const q = String(query || '').trim();
    if (!q) return this.list({ limit });
    const like = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`;
    return this.db
      .prepare(
        `SELECT * FROM history
         WHERE title LIKE @like ESCAPE '\\' OR url LIKE @like ESCAPE '\\'
         ORDER BY last_visit DESC LIMIT @limit`,
      )
      .all({ like, limit })
      .map(normalizeEntry);
  }

  /** Lightweight prefix match used for address-bar autocomplete. */
  suggest(query, { limit = 6 } = {}) {
    if (!this.db.available) return [];
    const q = String(query || '').trim();
    if (!q) return [];
    const like = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`;
    return this.db
      .prepare(
        `SELECT url, title, visit_count FROM history
         WHERE url LIKE @like ESCAPE '\\' OR title LIKE @like ESCAPE '\\'
         ORDER BY visit_count DESC, last_visit DESC LIMIT @limit`,
      )
      .all({ like, limit })
      .map((row) => ({ url: row.url, title: row.title || row.url, visits: row.visit_count }));
  }

  remove(ids) {
    if (!this.db.available) return 0;
    const list = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Number.isFinite);
    if (!list.length) return 0;
    const placeholders = list.map(() => '?').join(',');
    const info = this.db.prepare(`DELETE FROM history WHERE id IN (${placeholders})`).run(...list);
    this._pruneTopSites();
    return info.changes;
  }

  /** Drop derived top sites whose host no longer has any history; keep pinned entries. */
  _pruneTopSites() {
    if (!this.db.available) return;
    this.db
      .prepare(
        `DELETE FROM top_sites
         WHERE pinned = 0 AND host NOT IN (SELECT DISTINCT host FROM history)`,
      )
      .run();
  }

  clear({ since = 0 } = {}) {
    if (!this.db.available) return 0;
    if (since > 0) {
      const changes = this.db.prepare('DELETE FROM history WHERE last_visit >= ?').run(since).changes;
      this.db.prepare('DELETE FROM sessions_closed WHERE closed_at >= ?').run(since);
      this._pruneTopSites();
      return changes;
    }
    // "Clear all history" must also remove the derived top sites and the
    // recently-closed list; otherwise sensitive hosts remain visible on the
    // new-tab page after the user believes everything was deleted.
    const changes = this.db.prepare('DELETE FROM history').run().changes;
    this.db.prepare('DELETE FROM top_sites').run();
    this.db.prepare('DELETE FROM sessions_closed').run();
    return changes;
  }

  topSites({ limit = 8 } = {}) {
    if (!this.db.available) return [];
    return this.db
      .prepare(
        `SELECT * FROM top_sites ORDER BY pinned DESC, pinned_index ASC, visits DESC, last_visit DESC
         LIMIT @limit`,
      )
      .all({ limit })
      .map((row) => ({
        host: row.host,
        url: row.url,
        title: row.title || displayHost(row.url),
        visits: row.visits,
        lastVisit: row.last_visit,
        index: row.pinned_index,
        pinned: !!row.pinned,
      }));
  }

  pin(host, pinned) {
    if (!this.db.available) return;
    const max = this.db.prepare('SELECT COALESCE(MAX(pinned_index), -1) FROM top_sites').pluck().get();
    this.db
      .prepare('UPDATE top_sites SET pinned = @pinned, pinned_index = @idx WHERE host = @host')
      .run({ host, pinned: pinned ? 1 : 0, idx: pinned ? max + 1 : 0 });
  }

  removeTopSite(host) {
    if (!this.db.available) return;
    this.db.prepare('DELETE FROM top_sites WHERE host = ?').run(host);
  }

  recordClosed(url, title) {
    if (!this.enabled || !this.db.available) return;
    const clean = String(url || '').trim();
    if (!/^https?:\/\//i.test(clean)) return;
    this.db
      .prepare('INSERT INTO sessions_closed (url, title, closed_at) VALUES (?, ?, ?)')
      .run(clean.slice(0, 4096), String(title || '').slice(0, 300), Date.now());
    this.db
      .prepare(
        `DELETE FROM sessions_closed WHERE id NOT IN (
           SELECT id FROM sessions_closed ORDER BY closed_at DESC LIMIT 30
         )`,
      )
      .run();
  }

  recentlyClosed({ limit = 12 } = {}) {
    if (!this.db.available) return [];
    return this.db
      .prepare('SELECT url, title, closed_at FROM sessions_closed ORDER BY closed_at DESC LIMIT ?')
      .all(limit)
      .map((row) => ({ url: row.url, title: row.title || row.url, closedAt: row.closed_at }));
  }
}

module.exports = { HistoryService, MAX_HISTORY };
