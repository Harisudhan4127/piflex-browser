'use strict';

// Filter list registry. Only HTTPS sources from established projects are
// accepted. Lists are data, never executable code.

const MAX_FILTER_BYTES = 25 * 1024 * 1024;

const FILTER_LISTS = Object.freeze([
  {
    id: 'easylist',
    name: 'EasyList',
    description: 'General advertising and annoyances.',
    url: 'https://easylist.to/easylist/easylist.txt',
    homepage: 'https://easylist.to/',
    license: 'GPLv3 / CC BY-SA 3.0',
    category: 'ads',
    defaultEnabled: true,
  },
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    description: 'Tracking pixels, analytics and tracking scripts.',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    homepage: 'https://easylist.to/',
    license: 'GPLv3 / CC BY-SA 3.0',
    category: 'privacy',
    defaultEnabled: true,
  },
  {
    id: 'ublock-filters',
    name: 'uBlock Origin filters',
    description: 'Community-maintained general filter rules.',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
    homepage: 'https://github.com/uBlockOrigin/uAssets',
    license: 'GPLv3',
    category: 'ads',
    defaultEnabled: false,
  },
  {
    id: 'ublock-privacy',
    name: 'uBlock Origin privacy',
    description: 'Additional privacy-protection rules.',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',
    homepage: 'https://github.com/uBlockOrigin/uAssets',
    license: 'GPLv3',
    category: 'privacy',
    defaultEnabled: false,
  },
]);

const FALLBACK_HOSTS = [
  'doubleclick.net',
  'google-analytics.com',
  'googletagmanager.com',
  'googlesyndication.com',
  'adservice.google.com',
  'adnxs.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'scorecardresearch.com',
  'quantserve.com',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'segment.io',
  'mixpanel.com',
  'amplitude.com',
  'branch.io',
  'appsflyer.com',
  'adjust.com',
  'adsrvr.org',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'smartadserver.com',
  'yieldmo.com',
  'zedo.com',
  'adcolony.com',
  'applovin.com',
  'unityads.unity3d.com',
];

const FALLBACK_FILTER_TEXT = [
  '[Adblock Plus 2.0]',
  '! PiFlex built-in fallback list. Used only until maintained lists are',
  '! downloaded; it is intentionally small and conservative.',
  ...FALLBACK_HOSTS.map((host) => `||${host}^`),
  '||amazon-adsystem.com^',
  '||ads-twitter.com^',
  '||static.ads-twitter.com^',
].join('\n');

// Small, high-confidence site fixes that are always compiled in addition to the
// user's filter lists. They are data only and never injected as code.
const BUILTIN_EXTRA_FILTER_TEXT = [
  '[Adblock Plus 2.0]',
  '! PiFlex built-in site fixes.',
  '||youtube.com/api/stats/ads',
  '||youtube.com/pagead/',
  '||youtube.com/get_midroll_info',
  '||youtube.com/pcs/activeview',
  '||youtube.com/ptracking',
  '/^https?:\\/\\/[^/]*googlevideo\\.com\\/videoplayback\\?.*(?:&|\\?)adformat=/',
].join('\n');

function getFilterList(id) {
  return FILTER_LISTS.find((list) => list.id === id) || null;
}

function validateFilterText(text, maxBytes = MAX_FILTER_BYTES) {
  const value = String(text == null ? '' : text);
  if (!value) return { ok: false, reason: 'Empty filter list' };
  if (Buffer.byteLength(value, 'utf8') > maxBytes) {
    return { ok: false, reason: 'Filter list exceeds the size limit' };
  }
  if (value.includes('\u0000')) return { ok: false, reason: 'Filter list contains binary data' };
  const head = value.slice(0, 512);
  if (!/\[Adblock Plus/i.test(head) && !/^\s*!/m.test(head)) {
    return { ok: false, reason: 'Response does not look like an Adblock filter list' };
  }
  const lines = value.split(/\r?\n/);
  if (lines.length < 2) return { ok: false, reason: 'Filter list has no rules' };
  return { ok: true, reason: '' };
}

function listCacheName(id) {
  return `list-${String(id).replace(/[^a-z0-9-]/gi, '').toLowerCase()}.txt`;
}

module.exports = {
  BUILTIN_EXTRA_FILTER_TEXT,
  FALLBACK_FILTER_TEXT,
  FALLBACK_HOSTS,
  FILTER_LISTS,
  MAX_FILTER_BYTES,
  getFilterList,
  listCacheName,
  validateFilterText,
};
