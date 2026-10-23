'use strict';

const { JsonStore } = require('./json-store');

const MAX_RESTORED_TABS = 30;

function isValidSessionUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function sanitizeSession(raw) {
  if (!raw || typeof raw !== 'object') return { tabs: [], activeIndex: 0 };
  const tabs = [];
  const seen = new Set();
  for (const item of Array.isArray(raw.tabs) ? raw.tabs : []) {
    if (!item || !isValidSessionUrl(item.url)) continue;
    const url = String(item.url).slice(0, 4096);
    if (seen.has(url)) continue;
    seen.add(url);
    tabs.push({
      url,
      title: String(item.title || url).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) || url,
    });
    if (tabs.length >= MAX_RESTORED_TABS) break;
  }
  const activeIndex = Math.max(0, Math.min(tabs.length - 1, Number(raw.activeIndex) || 0));
  return { tabs, activeIndex };
}

class SessionStore extends JsonStore {
  constructor(filePath, options = {}) {
    super(filePath, {
      defaultValue: { tabs: [], activeIndex: 0 },
      debounceMs: 1000,
      legacyPaths: options.legacyPaths || [],
      sanitize: sanitizeSession,
    });
  }

  saveSession(tabs, activeIndex) {
    this.data = sanitizeSession({ tabs, activeIndex });
    this.scheduleSave();
  }

  getSession() {
    return sanitizeSession(this.data);
  }

  clear() {
    this.data = { tabs: [], activeIndex: 0 };
    this.scheduleSave();
  }
}

module.exports = {
  MAX_RESTORED_TABS,
  SessionStore,
  isValidSessionUrl,
  sanitizeSession,
};
