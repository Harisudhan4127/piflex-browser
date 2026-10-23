'use strict';

const { listEngines, getEngine, normalizeCustomEngines } = require('../../../core/search');
const { classifyInput } = require('../../../core/url');

/**
 * Address-bar autocomplete. Combines local bookmarks and history with a search
 * suggestion. External network suggestions are intentionally disabled to avoid
 * leaking typed text; the setting is surfaced but not honoured against a remote
 * endpoint.
 */
class SearchService {
  constructor({ settingsService, bookmarkService, historyService }) {
    this.settings = settingsService;
    this.bookmarks = bookmarkService;
    this.history = historyService;
  }

  engines() {
    const custom = normalizeCustomEngines(this.settings.get().search.custom);
    return listEngines(custom);
  }

  defaultEngine() {
    const s = this.settings.get();
    return getEngine(s.search.engineId, s.search.custom);
  }

  suggest(query, { limit = 8 } = {}) {
    const text = String(query || '').trim();
    if (!text) return [];
    const out = [];
    const classified = classifyInput(text);

    if (classified.kind === 'url') {
      out.push({ kind: 'url', title: text, url: classified.url, detail: 'Open' });
    } else if (classified.kind === 'search') {
      const engine = this.defaultEngine();
      out.push({
        kind: 'search',
        title: text,
        url: engine.template.replace('{query}', encodeURIComponent(text)),
        detail: `Search with ${engine.name}`,
      });
    }

    const localSuggestions = this.settings.get().search.localSuggestions;
    if (localSuggestions) {
      for (const bm of this.bookmarks.search(text).slice(0, 4)) {
        out.push({ kind: 'bookmark', title: bm.title, url: bm.url, detail: bm.folder });
      }
      for (const entry of this.history.suggest(text, { limit: 6 })) {
        out.push({ kind: 'history', title: entry.title, url: entry.url, detail: 'History' });
      }
    }

    const seen = new Set();
    return out
      .filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      })
      .slice(0, limit);
  }

  resolve(input) {
    const classified = classifyInput(input);
    if (classified.kind === 'url') return { kind: 'url', url: classified.url };
    if (classified.kind === 'empty') return { kind: 'empty' };
    if (classified.kind === 'blocked') return { kind: 'blocked', reason: classified.reason };
    const engine = this.defaultEngine();
    return { kind: 'search', url: engine.template.replace('{query}', encodeURIComponent(classified.value)) };
  }
}

module.exports = { SearchService };
