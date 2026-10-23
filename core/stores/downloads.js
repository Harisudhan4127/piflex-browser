'use strict';

const { JsonStore } = require('./json-store');
const { isValidState, sanitizeFilename } = require('../downloads');

const MAX_DOWNLOAD_HISTORY = 100;

function normalizeDownload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const filename = sanitizeFilename(raw.filename);
  const id = String(raw.id || `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 80);
  const state = isValidState(raw.state) ? raw.state : 'failed';
  return {
    id,
    filename,
    path: typeof raw.path === 'string' ? raw.path.slice(0, 2048) : '',
    url: typeof raw.url === 'string' ? raw.url.slice(0, 4096) : '',
    mime: String(raw.mime || '').slice(0, 200),
    total: Math.max(0, Number(raw.total) || 0),
    received: Math.max(0, Number(raw.received) || 0),
    state: ['active', 'paused'].includes(state) ? 'interrupted' : state,
    risky: !!raw.risky,
    started: Number(raw.started) || Date.now(),
    finished: Number(raw.finished) || null,
    error: raw.error ? String(raw.error).slice(0, 500) : null,
  };
}

function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw.slice(-MAX_DOWNLOAD_HISTORY * 2)) {
    const entry = normalizeDownload(item);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out.slice(-MAX_DOWNLOAD_HISTORY);
}

class DownloadStore extends JsonStore {
  constructor(filePath, options = {}) {
    super(filePath, {
      defaultValue: [],
      debounceMs: 250,
      legacyPaths: options.legacyPaths || [],
      sanitize: normalizeHistory,
    });
  }

  upsert(entry) {
    const item = normalizeDownload(entry);
    if (!item) return null;
    const index = this.data.findIndex((existing) => existing.id === item.id);
    if (index === -1) {
      this.data.push(item);
      if (this.data.length > MAX_DOWNLOAD_HISTORY) {
        this.data = this.data.slice(-MAX_DOWNLOAD_HISTORY);
      }
    } else {
      this.data[index] = { ...this.data[index], ...item, state: item.state || this.data[index].state };
    }
    this.scheduleSave();
    return item;
  }

  update(id, patch) {
    const index = this.data.findIndex((entry) => entry.id === id);
    if (index === -1) return null;
    const merged = normalizeDownload({ ...this.data[index], ...patch, id });
    if (!merged) return null;
    this.data[index] = merged;
    this.scheduleSave();
    return merged;
  }

  list(limit = 100) {
    return this.data
      .slice()
      .sort((a, b) => b.started - a.started)
      .slice(0, Math.max(1, Math.min(MAX_DOWNLOAD_HISTORY, Number(limit) || 100)));
  }

  remove(id) {
    const before = this.data.length;
    this.data = this.data.filter((entry) => entry.id !== id);
    if (this.data.length !== before) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  clearCompleted() {
    this.data = this.data.filter((entry) => ['active', 'paused'].includes(entry.state));
    this.scheduleSave();
  }
}

module.exports = {
  DownloadStore,
  MAX_DOWNLOAD_HISTORY,
  normalizeDownload,
  normalizeHistory,
};
