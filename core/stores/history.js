'use strict';

const { JsonStore } = require('./json-store');

const DEFAULT_MAX_ITEMS = 10000;
const DEFAULT_RETENTION_DAYS = 90;

function isValidHistoryUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object' || !isValidHistoryUrl(raw.url)) return null;
  return {
    id: String(raw.id || `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 80),
    url: String(raw.url).slice(0, 4096),
    title: String(raw.title || raw.url || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) ||
      String(raw.url).slice(0, 300),
    visited: Number(raw.visited) || Date.now(),
  };
}

function normalizeEntries(raw, maxItems, retentionDays) {
  if (!Array.isArray(raw)) return [];
  const cutoff = retentionDays > 0 ? Date.now() - retentionDays * 86400000 : 0;
  const out = [];
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (!entry) continue;
    if (cutoff && entry.visited < cutoff) continue;
    out.push(entry);
  }
  out.sort((a, b) => a.visited - b.visited);
  return out.slice(-maxItems);
}

class HistoryStore extends JsonStore {
  constructor(filePath, options = {}) {
    const maxItems = Math.max(10, Math.min(50000, Number(options.maxItems) || DEFAULT_MAX_ITEMS));
    const retentionDays = Math.max(0, Math.min(3650, Number(options.retentionDays) || DEFAULT_RETENTION_DAYS));
    super(filePath, {
      defaultValue: [],
      debounceMs: 750,
      legacyPaths: options.legacyPaths || [],
      sanitize: (data) => normalizeEntries(data, maxItems, retentionDays),
    });
    this.maxItems = maxItems;
    this.retentionDays = retentionDays;
  }

  add({ url, title }) {
    if (!isValidHistoryUrl(url)) return null;
    const cleanUrl = String(url).slice(0, 4096);
    const last = this.data[this.data.length - 1];
    if (last && last.url === cleanUrl && Date.now() - last.visited < 120000) {
      last.title = String(title || last.title).slice(0, 300);
      last.visited = Date.now();
      this.scheduleSave();
      return last;
    }
    const entry = normalizeEntry({
      url: cleanUrl,
      title,
      visited: Date.now(),
    });
    if (!entry) return null;
    this.data.push(entry);
    if (this.data.length > this.maxItems) this.data = this.data.slice(-this.maxItems);
    this.scheduleSave();
    return entry;
  }

  search(query = '', limit = 200) {
    const q = String(query || '').toLowerCase().trim();
    const max = Math.max(1, Math.min(1000, Number(limit) || 200));
    const filtered = q
      ? this.data.filter(
          (entry) =>
            entry.url.toLowerCase().includes(q) || entry.title.toLowerCase().includes(q),
        )
      : this.data;
    return filtered.slice(-max).reverse();
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

  clearRange({ from, to } = {}) {
    const start = Number(from) || 0;
    const end = Number(to) || Date.now();
    this.data = this.data.filter((entry) => entry.visited < start || entry.visited > end);
    this.scheduleSave();
  }

  clearAll() {
    this.data = [];
    this.scheduleSave();
  }

  stats() {
    return {
      count: this.data.length,
      oldest: this.data.length ? this.data[0].visited : null,
      newest: this.data.length ? this.data[this.data.length - 1].visited : null,
    };
  }
}

module.exports = {
  DEFAULT_MAX_ITEMS,
  DEFAULT_RETENTION_DAYS,
  HistoryStore,
  isValidHistoryUrl,
  normalizeEntries,
  normalizeEntry,
};
