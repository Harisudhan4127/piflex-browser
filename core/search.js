'use strict';

const { replaceQuery } = require('./url');

const BUILT_IN_ENGINES = Object.freeze([
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    template: 'https://duckduckgo.com/?q={query}',
    description: 'Privacy-focused search',
    builtIn: true,
  },
  {
    id: 'google',
    name: 'Google',
    template: 'https://www.google.com/search?q={query}',
    description: 'Google web search',
    builtIn: true,
  },
  {
    id: 'bing',
    name: 'Bing',
    template: 'https://www.bing.com/search?q={query}',
    description: 'Microsoft Bing',
    builtIn: true,
  },
  {
    id: 'brave',
    name: 'Brave Search',
    template: 'https://search.brave.com/search?q={query}',
    description: 'Independent index',
    builtIn: true,
  },
  {
    id: 'startpage',
    name: 'Startpage',
    template: 'https://www.startpage.com/sp/search?query={query}',
    description: 'Google results with privacy',
    builtIn: true,
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    template: 'https://en.wikipedia.org/w/index.php?search={query}',
    description: 'Encyclopedia',
    builtIn: true,
  },
]);

function normalizeEngine(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim().toLowerCase();
  const name = String(raw.name || '').trim();
  const template = String(raw.template || '').trim();
  if (!id || !name || !template) return null;
  if (!/^https:\/\//i.test(template)) return null;
  if (!template.includes('{query}')) return null;
  return {
    id: id.replace(/[^a-z0-9_-]/g, '-').slice(0, 48),
    name: name.slice(0, 64),
    template: template.slice(0, 2048),
    description: String(raw.description || 'Custom search engine').slice(0, 120),
    builtIn: false,
  };
}

function normalizeCustomEngines(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set(BUILT_IN_ENGINES.map((engine) => engine.id));
  const out = [];
  for (const item of list.slice(0, 40)) {
    const engine = normalizeEngine(item);
    if (!engine || seen.has(engine.id)) continue;
    seen.add(engine.id);
    out.push(engine);
  }
  return out;
}

function listEngines(customEngines = []) {
  return [...BUILT_IN_ENGINES, ...normalizeCustomEngines(customEngines)];
}

function getEngine(engineId, customEngines = []) {
  const engines = listEngines(customEngines);
  const found = engines.find((engine) => engine.id === engineId);
  return found || engines[0];
}

function buildSearchUrl(engine, query) {
  const clean = String(query == null ? '' : query).trim();
  if (!clean) return null;
  const chosen = engine && engine.template ? engine : BUILT_IN_ENGINES[0];
  return replaceQuery(chosen.template, clean);
}

module.exports = {
  BUILT_IN_ENGINES,
  buildSearchUrl,
  getEngine,
  listEngines,
  normalizeCustomEngines,
  normalizeEngine,
};
