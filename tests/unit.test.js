'use strict';

// Unit and regression tests for browser-independent core modules.
// Run: node tests/unit.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = require('../core/url');
const search = require('../core/search');
const settingsSchema = require('../core/settings-schema');
const downloads = require('../core/downloads');
const { AdBlockFilterEngine } = require('../core/adblock/engine');
const { FILTER_LISTS, FALLBACK_FILTER_TEXT, validateFilterText } = require('../core/adblock/lists');
const { BookmarkStore } = require('../core/stores/bookmarks');
const { HistoryStore } = require('../core/stores/history');
const { SessionStore, sanitizeSession } = require('../core/stores/sessions');
const { DownloadStore } = require('../core/stores/downloads');
const { SettingsStore } = require('../core/stores/settings');
const { JsonStore } = require('../core/stores/json-store');
const memory = require('../core/ai/memory');
const prompt = require('../core/ai/prompt');
const runtime = require('../core/ai/runtime');
const catalog = require('../core/ai/catalog');
const { assetScore, findServerBinary } = require('../src/main/services/runtime-service.cjs');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    failures.push({ name, error });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'piflex-tests-'));
let tempCounter = 0;
function tempFile(name) {
  tempCounter++;
  return path.join(tmpRoot, `${tempCounter}-${name}`);
}

// ---------------------------------------------------------------------------
// URL handling
// ---------------------------------------------------------------------------
test('classifies bare domain as HTTPS URL', () => {
  const result = url.classifyInput('example.com/path?q=1');
  assert.strictEqual(result.kind, 'url');
  assert.strictEqual(result.url, 'https://example.com/path?q=1');
});

test('classifies localhost and IP addresses as HTTP URL', () => {
  assert.strictEqual(url.classifyInput('localhost:3000').url, 'http://localhost:3000/');
  assert.strictEqual(url.classifyInput('192.168.1.5:8080/admin').url, 'http://192.168.1.5:8080/admin');
});

test('classifies free text as search', () => {
  assert.strictEqual(url.classifyInput('how to test a browser').kind, 'search');
});

test('blocks dangerous schemes', () => {
  assert.strictEqual(url.classifyInput('javascript:alert(1)').kind, 'blocked');
  assert.strictEqual(url.classifyInput('data:text/html,<h1>x</h1>').kind, 'blocked');
  assert.strictEqual(url.classifyInput('file:///etc/passwd').kind, 'url');
});

test('blocks unknown external schemes from automatic navigation', () => {
  assert.strictEqual(url.classifyInput('mailto:test@example.com').kind, 'blocked');
});

test('supports internationalized domain names', () => {
  const result = url.classifyInput('münich.de');
  assert.strictEqual(result.kind, 'url');
  assert(result.url.includes('xn--'));
});

test('top-level navigation policy prevents remote-to-local file escape', () => {
  assert.strictEqual(url.isAllowedTopLevelNavigation('https://example.com', 'https://a.com'), true);
  assert.strictEqual(url.isAllowedTopLevelNavigation('file:///etc/passwd', 'https://a.com'), false);
  assert.strictEqual(url.isAllowedTopLevelNavigation('javascript:alert(1)', 'https://a.com'), false);
  assert.strictEqual(url.isAllowedTopLevelNavigation('file:///tmp/a.html', 'file:///tmp/b.html'), true);
});

test('reports security state without claiming certificate verification', () => {
  assert.strictEqual(url.securityState('https://example.com').level, 'secure');
  assert.strictEqual(url.securityState('http://example.com').level, 'insecure');
  assert.strictEqual(url.securityState('file:///tmp/x').level, 'local');
});

test('registrable domain and third-party detection', () => {
  assert.strictEqual(url.registrableDomain('ads.example.co.uk'), 'example.co.uk');
  assert.strictEqual(url.isThirdParty('https://cdn.example.com/x', 'https://www.example.com/'), false);
  assert.strictEqual(url.isThirdParty('https://tracker.net/x', 'https://www.example.com/'), true);
});

test('display host strips www and URL helpers are safe', () => {
  assert.strictEqual(url.displayHost('https://www.example.com/a'), 'example.com');
  assert.strictEqual(url.hostnameOf('not a url'), '');
  assert.strictEqual(url.isSafeExternalUrl('mailto:x@y.com'), false);
  assert.strictEqual(url.isSafeExternalUrl('https://example.com'), true);
});

// ---------------------------------------------------------------------------
// Search engines
// ---------------------------------------------------------------------------
test('search engine builds encoded URL', () => {
  const engine = search.getEngine('duckduckgo');
  assert.strictEqual(
    search.buildSearchUrl(engine, 'a b&c'),
    'https://duckduckgo.com/?q=a%20b%26c',
  );
});

test('custom search engines require HTTPS and a query placeholder', () => {
  assert.strictEqual(search.normalizeEngine({ id: 'x', name: 'X', template: 'http://x/?q={query}' }), null);
  assert.strictEqual(search.normalizeEngine({ id: 'x', name: 'X', template: 'https://x/?q=' }), null);
  const valid = search.normalizeEngine({ id: 'x', name: 'X', template: 'https://x/?q={query}' });
  assert(valid && valid.id === 'x');
});

test('custom search engines are deduplicated against built-ins', () => {
  const list = search.normalizeCustomEngines([
    { id: 'duckduckgo', name: 'Dup', template: 'https://x/{query}' },
    { id: 'mine', name: 'Mine', template: 'https://m/{query}' },
    { id: 'mine', name: 'Mine 2', template: 'https://m2/{query}' },
  ]);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].id, 'mine');
});

// ---------------------------------------------------------------------------
// Settings schema
// ---------------------------------------------------------------------------
test('settings clamps values and removes unknown keys', () => {
  const settings = settingsSchema.normalizeSettings({
    theme: 'neon',
    tabs: { maxTabs: 9999, suspendAfterMinutes: -4, evil: true },
    ai: { contextTokens: 9999999, maxTokens: 5, provider: 'cloud' },
    unknownTopLevel: 'nope',
  });
  assert.strictEqual(settings.theme, 'system');
  assert.strictEqual(settings.tabs.maxTabs, 100);
  assert.strictEqual(settings.tabs.suspendAfterMinutes, 0);
  assert.strictEqual(settings.ai.contextTokens, 32768);
  assert.strictEqual(settings.ai.maxTokens, 32);
  assert.strictEqual(settings.ai.provider, 'ollama');
  assert.strictEqual(settings.unknownTopLevel, undefined);
  assert.strictEqual(settings.tabs.evil, undefined);
});

test('settings sanitizes custom engines and filter list ids', () => {
  const settings = settingsSchema.normalizeSettings({
    search: { custom: [{ id: 'ok', name: 'OK', template: 'https://ok/{query}' }] },
    privacy: { filterListIds: ['easylist', '../../bad', 'nope'] },
  });
  assert.strictEqual(settings.search.custom.length, 1);
  assert.deepStrictEqual(settings.privacy.filterListIds, ['easylist']);
});

test('external search suggestions are always disabled', () => {
  const settings = settingsSchema.normalizeSettings({ search: { externalSuggestions: true } });
  assert.strictEqual(settings.search.externalSuggestions, false);
});

// ---------------------------------------------------------------------------
// Download naming
// ---------------------------------------------------------------------------
test('download filenames are sanitized against traversal', () => {
  assert.strictEqual(downloads.sanitizeFilename('../../etc/passwd'), 'passwd');
  assert.strictEqual(downloads.sanitizeFilename('a<b>c.txt'), 'a_b_c.txt');
  assert.strictEqual(downloads.sanitizeFilename(''), 'download');
});

test('download destinations are unique and risky extensions are flagged', () => {
  const existing = new Set([path.join('/d', 'file.txt')]);
  assert.strictEqual(
    downloads.uniqueDestination('/d', 'file.txt', (value) => existing.has(value)),
    path.join('/d', 'file (1).txt'),
  );
  assert.strictEqual(downloads.isRiskyFilename('setup.EXE'), true);
  assert.strictEqual(downloads.isRiskyFilename('photo.jpg'), false);
});

// ---------------------------------------------------------------------------
// Ad blocker
// ---------------------------------------------------------------------------
test('host rule blocks domain and subdomains but not lookalikes', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('||doubleclick.net^');
  assert.strictEqual(engine.match('https://ad.doubleclick.net/x').blocked, true);
  assert.strictEqual(engine.match('https://notdoubleclick.net/x').blocked, false);
  assert.strictEqual(engine.match('https://doubleclick.net.evil.com/x').blocked, false);
});

test('host+path rules match path prefixes', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('||example.com^/ads/');
  assert.strictEqual(engine.match('https://example.com/ads/banner.js').blocked, true);
  assert.strictEqual(engine.match('https://example.com/news/').blocked, false);
});

test('generic wildcard rules use keyword prefilter', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('/adserver/*\n-banner-');
  assert.strictEqual(engine.match('https://cdn.example.net/adserver/x.png').blocked, true);
  assert.strictEqual(engine.match('https://cdn.example.net/a-banner-image.png').blocked, true);
  assert.strictEqual(engine.match('https://cdn.example.net/news.png').blocked, false);
});

test('exceptions override normal blocks but not important blocks', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('||tracker.test^\n@@||good.tracker.test^\n||important.test^$important\n@@||important.test^');
  assert.strictEqual(engine.match('https://tracker.test/x').blocked, true);
  assert.strictEqual(engine.match('https://good.tracker.test/x').blocked, false);
  assert.strictEqual(engine.match('https://important.test/x').blocked, true);
});

test('third-party and domain options are enforced', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('||tracker.test^$third-party\n||scoped.test^$domain=news.example|~skip.example');
  assert.strictEqual(
    engine.match('https://tracker.test/x', { documentUrl: 'https://shop.example/' }).blocked,
    true,
  );
  assert.strictEqual(
    engine.match('https://tracker.test/x', { documentUrl: 'https://tracker.test/' }).blocked,
    false,
  );
  assert.strictEqual(
    engine.match('https://scoped.test/x', { documentUrl: 'https://news.example/' }).blocked,
    true,
  );
  assert.strictEqual(
    engine.match('https://scoped.test/x', { documentUrl: 'https://skip.example/' }).blocked,
    false,
  );
  assert.strictEqual(
    engine.match('https://scoped.test/x', { documentUrl: 'https://other.example/' }).blocked,
    false,
  );
});

test('resource type options are enforced', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('||images.test^$image\n||scripts.test^$~script');
  assert.strictEqual(engine.match('https://images.test/a.png', { type: 'image' }).blocked, true);
  assert.strictEqual(engine.match('https://images.test/a.js', { type: 'script' }).blocked, false);
  assert.strictEqual(engine.match('https://scripts.test/a.js', { type: 'script' }).blocked, false);
  assert.strictEqual(engine.match('https://scripts.test/a.png', { type: 'image' }).blocked, true);
});

test('unsupported/unsafe rules are skipped, not broadened', () => {
  const engine = new AdBlockFilterEngine();
  engine.load([
    '! comment',
    '[Adblock Plus 2.0]',
    '||x.test^$removeparam=utm',
    '||y.test^$csp=script-src none',
    '/(a+)+$/',
    '||ok.test^',
    '||good.test^$domain=allowed.test',
  ].join('\n'));
  assert.strictEqual(engine.stats().networkRules, 2);
  assert.strictEqual(engine.match('https://x.test/x').blocked, false);
  assert.strictEqual(
    engine.match('https://good.test/x', { documentUrl: 'https://allowed.test/' }).blocked,
    true,
  );
});

test('regex rules compile and match', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('/ad[0-9]+\\.example\\.com/');
  assert.strictEqual(engine.match('https://ad42.example.com/x').blocked, true);
});

test('regex with a literal escaped dollar is not parsed as options', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('/track\\$pixel\\.test\\//');
  assert.strictEqual(engine.match('https://cdn.example.com/track$pixel.test/x').blocked, true);
  assert.strictEqual(engine.stats().networkRules, 1);
});

test('options with a value are parsed without error', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('||x.test^$domain=allowed.test\n||y.test^$badfilter');
  assert.strictEqual(engine.match('https://x.test/x', { documentUrl: 'https://allowed.test/' }).blocked, true);
  assert.strictEqual(engine.match('https://y.test/x').blocked, false);
});

test('recommended disk cache respects the hardware cap', () => {
  const { recommendedDiskCacheMB } = require('../src/main/hardware.cjs');
  assert.strictEqual(recommendedDiskCacheMB(256, { totalMB: 1024 }), 102);
  assert.strictEqual(recommendedDiskCacheMB(64, { totalMB: 8192 }), 64);
  assert.strictEqual(recommendedDiskCacheMB(4096, { totalMB: 16384 }), 1638);
});

test('architecture family classifies x86 and arm desktop targets', () => {
  const { archFamily, recommendedMaxTabs } = require('../src/main/hardware.cjs');
  assert.strictEqual(archFamily('x64'), 'x86');
  assert.strictEqual(archFamily('arm64'), 'arm64');
  assert.strictEqual(archFamily('arm'), 'arm');
  assert.strictEqual(recommendedMaxTabs({ totalMB: 2048 }), 20);
  assert.strictEqual(recommendedMaxTabs({ totalMB: 16384 }), 80);
});

test('recommended context tokens shrink for a small model budget', () => {
  const { recommendedContextTokens } = require('../core/ai/memory');
  const tokens = recommendedContextTokens(
    { ai: { modelId: 'big', contextTokens: 8192 } },
    [{ id: 'big', approxSizeMB: 8000, paramsB: 8, contextMax: 8192 }],
  );
  assert.ok(tokens >= 512 && tokens <= 8192);
});

test('cosmetic rules are domain-scoped and sanitized', () => {
  const engine = new AdBlockFilterEngine();
  engine.load([
    '##.global-ad',
    'example.com##.site-ad',
    'example.com,~safe.example.com##.conditional-ad',
    'example.com#@#.global-ad',
    'bad.example##div { background: url(javascript:alert(1)) }',
  ].join('\n'));
  const selectors = engine.getCosmeticSelectors('example.com');
  assert(selectors.includes('.site-ad'));
  assert(selectors.includes('.conditional-ad'));
  assert(!selectors.includes('.global-ad'));
  assert.strictEqual(engine.getCosmeticSelectors('safe.example.com').includes('.conditional-ad'), false);
  assert.strictEqual(engine.getCosmeticSelectors('other.com').includes('.global-ad'), true);
  assert.strictEqual(engine.stats().cosmeticRules, 4);
});

test('fallback list compiles and blocks known trackers', () => {
  const engine = new AdBlockFilterEngine();
  engine.load(FALLBACK_FILTER_TEXT);
  assert(engine.isReady());
  assert.strictEqual(engine.match('https://www.google-analytics.com/collect').blocked, true);
  assert.strictEqual(engine.match('https://example.com/').blocked, false);
});

test('load() keeps rules from multiple filter list sources', () => {
  const engine = new AdBlockFilterEngine();
  engine.load([
    { name: 'one', text: '||one.test^' + '\n' },
    { name: 'two', text: '||two.test^' + '\n' },
  ]);
  assert.strictEqual(engine.match('https://one.test/ads.js').blocked, true);
  assert.strictEqual(engine.match('https://two.test/ads.js').blocked, true);
  assert(engine.stats().networkRules >= 2);
  assert.strictEqual(engine.sources.length, 2);
});

test('normalizes Electron resource types for matching', () => {
  const { normalizeResourceType } = require('../core/adblock/engine');
  assert.strictEqual(normalizeResourceType('mainFrame'), 'document');
  assert.strictEqual(normalizeResourceType('subFrame'), 'subdocument');
  assert.strictEqual(normalizeResourceType('xhr'), 'xmlhttprequest');
  assert.strictEqual(normalizeResourceType('image'), 'image');
  assert.strictEqual(normalizeResourceType('made-up'), 'other');
});

test('match context uses documentUrl and resource type', () => {
  const engine = new AdBlockFilterEngine();
  engine.load('||tracker.test^$third-party,script');
  assert.strictEqual(
    engine.match('https://tracker.test/a.js', { type: 'script', documentUrl: 'https://site.test/' }).blocked,
    true,
  );
  assert.strictEqual(
    engine.match('https://tracker.test/a.js', { type: 'image', documentUrl: 'https://site.test/' }).blocked,
    false,
  );
  assert.strictEqual(
    engine.match('https://tracker.test/a.js', { type: 'script', documentUrl: 'https://tracker.test/' }).blocked,
    false,
  );
});

test('filter list metadata and validation are safe', () => {
  assert(FILTER_LISTS.every((list) => list.url.startsWith('https://')));
  assert.strictEqual(validateFilterText('').ok, false);
  assert.strictEqual(validateFilterText('not a filter list').ok, false);
  assert.strictEqual(validateFilterText('[Adblock Plus 2.0]\n||x.test^').ok, true);
});

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
test('bookmark store persists, deduplicates and edits', () => {
  const file = tempFile('bookmarks.json');
  const store = new BookmarkStore(file);
  const first = store.add({ title: 'One', url: 'https://one.test', folder: 'Work' });
  store.add({ title: 'One updated', url: 'https://one.test', folder: 'Work' });
  assert.strictEqual(store.list().length, 1);
  assert.strictEqual(store.list()[0].title, 'One updated');
  store.update(first.id, { folder: 'Later' });
  store.flush();
  const reopened = new BookmarkStore(file);
  assert.strictEqual(reopened.list()[0].folder, 'Later');
  assert.strictEqual(reopened.add({ title: 'x', url: 'javascript:alert(1)' }), null);
});

test('bookmark import deduplicates and search works', () => {
  const store = new BookmarkStore(tempFile('bookmarks2.json'));
  const added = store.importItems([
    { title: 'Alpha', url: 'https://a.test', folder: 'F' },
    { title: 'Alpha duplicate', url: 'https://a.test', folder: 'F' },
    { title: 'Beta', url: 'https://b.test', folder: 'G' },
  ]);
  assert.strictEqual(added, 2);
  assert.strictEqual(store.search('beta').length, 1);
  assert.deepStrictEqual(store.folders(), ['F', 'G']);
});

test('history store is bounded, deduplicates and clears ranges', () => {
  const store = new HistoryStore(tempFile('history.json'), { maxItems: 10, retentionDays: 0 });
  for (let i = 0; i < 20; i++) store.add({ url: `https://e.test/${i}`, title: `T${i}` });
  assert.strictEqual(store.data.length, 10);
  store.add({ url: 'https://e.test/19', title: 'updated' });
  assert.strictEqual(store.data[store.data.length - 1].title, 'updated');
  store.clearRange({ from: 0, to: Date.now() });
  assert.strictEqual(store.data.length, 0);
  assert.strictEqual(store.add({ url: 'javascript:alert(1)' }), null);
});

test('session store restores only valid HTTP(S) tabs', () => {
  const file = tempFile('session.json');
  const store = new SessionStore(file);
  store.saveSession([
    { url: 'https://a.test', title: 'A' },
    { url: 'file:///etc/passwd', title: 'Nope' },
    { url: 'https://a.test', title: 'A duplicate' },
  ], 7);
  store.flush();
  const reopened = new SessionStore(file);
  const session = reopened.getSession();
  assert.strictEqual(session.tabs.length, 1);
  assert.strictEqual(session.activeIndex, 0);
  assert.strictEqual(sanitizeSession({ tabs: 'bad' }).tabs.length, 0);
});

test('download store marks incomplete downloads interrupted', () => {
  const file = tempFile('downloads.json');
  const store = new DownloadStore(file);
  store.upsert({
    id: 'd1', filename: '../evil.txt', path: '/tmp/evil.txt', url: 'https://x.test/a',
    state: 'active', received: 10, total: 100, risky: true, started: Date.now(),
  });
  store.flush();
  const reopened = new DownloadStore(file);
  const item = reopened.list()[0];
  assert.strictEqual(item.state, 'interrupted');
  assert.strictEqual(item.filename, 'evil.txt');
  assert.strictEqual(reopened.remove('d1'), true);
});

test('settings store persists updates and permission overrides', () => {
  const file = tempFile('settings.json');
  const store = new SettingsStore(file);
  store.update({ theme: 'dark', tabs: { suspendAfterMinutes: 5 } });
  store.setPermission('https://example.com', 'geolocation', 'deny');
  store.setSiteAdblockExempt('example.com', true);
  store.flush();
  const reopened = new SettingsStore(file);
  assert.strictEqual(reopened.get().theme, 'dark');
  assert.strictEqual(reopened.get().tabs.suspendAfterMinutes, 5);
  assert.strictEqual(reopened.get().sites.permissionOverrides['https://example.com'].geolocation, 'deny');
  assert.deepStrictEqual(reopened.get().sites.adblockExempt, ['example.com']);
});

test('settings setPrivacy merges and persists privacy flags', () => {
  const file = tempFile('privacy.json');
  const store = new SettingsStore(file);
  store.setPrivacy({ adblock: false, filterListIds: ['easylist'] });
  store.flush();
  const reopened = new SettingsStore(file);
  assert.strictEqual(reopened.get().privacy.adblock, false);
  assert.deepStrictEqual(reopened.get().privacy.filterListIds, ['easylist']);
  assert.strictEqual(reopened.get().privacy.historyEnabled, true);
});

test('appearance background accepts only safe image data URLs', () => {
  const ok = settingsSchema.normalizeSettings({
    appearance: { backgroundImage: 'data:image/png;base64,AAAA' },
  });
  assert.strictEqual(ok.appearance.backgroundImage, 'data:image/png;base64,AAAA');
  const bad = settingsSchema.normalizeSettings({
    appearance: { backgroundImage: 'javascript:alert(1)' },
  });
  assert.strictEqual(bad.appearance.backgroundImage, null);
});

test('new tab wallpaper accepts bounded images and gradients', () => {
  const gradient = settingsSchema.normalizeSettings({
    newTab: { activeWallpaper: 'linear-gradient(135deg, #000 0%, #fff 100%)' },
  });
  assert.strictEqual(gradient.newTab.activeWallpaper, 'linear-gradient(135deg, #000 0%, #fff 100%)');

  const image = 'data:image/webp;base64,AAAA';
  assert.strictEqual(
    settingsSchema.normalizeSettings({ newTab: { activeWallpaper: image } }).newTab.activeWallpaper,
    image,
  );

  const tooBig = `data:image/png;base64,${'A'.repeat(4 * 1024 * 1024)}`;
  assert.strictEqual(
    settingsSchema.normalizeSettings({ newTab: { activeWallpaper: tooBig } }).newTab.activeWallpaper,
    null,
  );
  assert.strictEqual(
    settingsSchema.normalizeSettings({ newTab: { activeWallpaper: 'url(javascript:alert(1))' } })
      .newTab.activeWallpaper,
    null,
  );
});

test('corrupt JSON is backed up and replaced with defaults', () => {
  const file = tempFile('corrupt.json');
  fs.writeFileSync(file, '{not json');
  const store = new JsonStore(file, { defaultValue: { ok: true } });
  assert.deepStrictEqual(store.data, { ok: true });
  const backups = fs.readdirSync(tmpRoot).filter((name) => name.includes('corrupt.json.corrupt-'));
  assert(backups.length >= 1);
});

// ---------------------------------------------------------------------------
// AI config, prompt handling and memory budget
// ---------------------------------------------------------------------------
test('AI memory estimate and budget prevent overcommit', () => {
  const memoryInfo = { totalMB: 8192, freeMB: 3000, configuredBudgetMB: 2048 };
  assert(memory.computeBudget(memoryInfo) > 0);
  const small = memory.assessModelFit({
    fileSizeMB: 398, paramsB: 0.5, contextTokens: 2048, memory: memoryInfo,
  });
  const large = memory.assessModelFit({
    fileSizeMB: 2250, paramsB: 3.8, contextTokens: 8192,
    memory: { totalMB: 4096, freeMB: 900, configuredBudgetMB: 4096 },
  });
  assert.strictEqual(small.fits, true);
  assert.strictEqual(large.fits, false);
  assert(memory.estimateModelMemoryMB({ fileSizeMB: 800, paramsB: 1, contextTokens: 4096 }) > 800);
});

test('AI settings default to Ollama and allow user to switch to llama.cpp', () => {
  const defaults = settingsSchema.normalizeSettings({});
  assert.strictEqual(defaults.ai.provider, 'ollama');
  assert.strictEqual(defaults.ai.endpoint, 'http://127.0.0.1:11434');

  const changedToLlama = settingsSchema.normalizeSettings({ ai: { provider: 'llamacpp' } });
  assert.strictEqual(changedToLlama.ai.provider, 'llamacpp');

  const changedToOpenAi = settingsSchema.normalizeSettings({
    ai: { provider: 'openai-compatible', endpoint: 'https://api.openai.com', apiKey: 'sk-test' },
  });
  assert.strictEqual(changedToOpenAi.ai.provider, 'openai-compatible');
  assert.strictEqual(changedToOpenAi.ai.endpoint, 'https://api.openai.com');
  assert.strictEqual(changedToOpenAi.ai.apiKey, 'sk-test');
});

test('recommended context shrinks under a tight budget', () => {
  const model = { approxSizeMB: 1120, paramsB: 1.5, contextMax: 8192 };
  const tight = memory.recommendedContext(8192, model, { totalMB: 2048, freeMB: 850, configuredBudgetMB: 2048 });
  assert(tight < 8192 && tight >= 512);
});

test('prompt handling redacts credentials and bounds page context', () => {
  const dirty = 'Password: hunter2\nAPI_KEY=abcd1234\nnormal text';
  const clean = prompt.sanitizePageText(dirty);
  assert(!clean.includes('hunter2'));
  assert(!clean.includes('abcd1234'));
  assert(clean.includes('normal text'));
  const messages = prompt.buildMessages({
    history: [{ role: 'user', content: 'hi' }],
    userText: 'Summarize this',
    pageText: 'A'.repeat(100000),
    pageTitle: 'Test',
    contextTokens: 2048,
  });
  assert.strictEqual(messages[0].role, 'system');
  const user = messages[messages.length - 1];
  assert(user.content.length < 32001);
  assert(user.content.includes('Untrusted page content'));
});

test('prompt history is bounded and ignores invalid roles', () => {
  const history = [
    { role: 'system', content: 'ignore me' },
    { role: 'user', content: 'one' },
    { role: 'assistant', content: 'two' },
    { role: 'tool', content: 'nope' },
  ];
  const bounded = prompt.boundedHistory(history);
  assert.strictEqual(bounded.length, 2);
  assert.strictEqual(bounded[0].role, 'user');
});

test('llama.cpp arguments enforce single request and bounded context', () => {
  const args = runtime.buildLlamaServerArgs({
    modelPath: '/models/x.gguf', contextTokens: 4096, maxTokens: 256,
    threads: 4, gpuLayers: 'auto', host: '127.0.0.1', port: 18081,
  });
  assert(args.includes('--parallel'));
  assert.strictEqual(args[args.indexOf('--parallel') + 1], '1');
  assert.strictEqual(args[args.indexOf('-c') + 1], '4096');
  assert.strictEqual(args[args.indexOf('-n') + 1], '256');
  assert.strictEqual(args[args.indexOf('-ngl') + 1], '999');
});

test('AI prompt build accepts structured context and redacts secrets', () => {
  const messages = prompt.buildMessages({
    history: [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ],
    userText: 'What is this page about?',
    pageTitle: 'Example',
    pageText: 'PiFlex Browser uses Chromium. API key: sk_test_1234567890abcdefghij secret value=abc123',
    contextTokens: 2048,
  });
  assert(Array.isArray(messages));
  assert.strictEqual(messages[0].role, 'system');
  const last = messages[messages.length - 1];
  assert.strictEqual(last.role, 'user');
  assert(!last.content.includes('sk_test_1234567890abcdefghij'));
  assert(last.content.includes('[redacted'));
});

test('AI prompt treats page content as untrusted and truncates', () => {
  const long = 'page '.repeat(20000);
  const messages = prompt.buildMessages({
    userText: 'Summarize',
    pageText: long,
    pageTitle: 'Long Page',
    contextTokens: 1024,
  });
  const last = messages[messages.length - 1].content;
  assert(last.includes('Untrusted page content'));
  assert(last.includes('[content truncated'));
});

test('stream parsers ignore malformed fragments', () => {
  let content = '';
  const rest = runtime.parseSseLines(
    'data: {"choices":[{"delta":{"content":"hi"}}]}\ninvalid\n',
    (chunk) => { content += runtime.extractionOfOpenAiChunk(chunk); },
  );
  assert.strictEqual(content, 'hi');
  assert.strictEqual(rest, '');
  let ollama = '';
  runtime.parseJsonLines('{"message":{"content":"ok"}}\n{bad}\n', (chunk) => {
    ollama += runtime.extractionOfOllamaChunk(chunk);
  });
  assert.strictEqual(ollama, 'ok');
});

test('runtime asset selection prefers matching CPU builds', () => {
  const cpu = assetScore({ name: 'llama-b5000-bin-win-cpu-x64.zip' }, 'win32', 'x64');
  const cuda = assetScore({ name: 'llama-b5000-bin-win-cuda-cu12.2.0-x64.zip' }, 'win32', 'x64');
  assert(cpu > 0);
  assert(cpu > cuda);
  assert.strictEqual(assetScore({ name: 'llama-b5000-bin-ubuntu-x64.zip' }, 'win32', 'x64'), -1);
  assert(assetScore({ name: 'llama-b5000-bin-macos-arm64.zip' }, 'darwin', 'arm64') > 0);
  assert.strictEqual(assetScore({ name: 'llama-b5000-bin-macos-x64.zip' }, 'darwin', 'arm64'), -1);
  assert.strictEqual(assetScore({ name: 'llama-b5000-bin-win-cpu-x64.7z' }, 'win32', 'x64'), -1);
});

test('finds a llama-server binary in nested runtime folders', () => {
  const root = tempFile('runtime');
  const nested = path.join(root, 'llama-b5000', 'bin');
  fs.mkdirSync(nested, { recursive: true });
  const name = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  fs.writeFileSync(path.join(nested, name), '');
  assert.strictEqual(findServerBinary(root), path.join(nested, name));
  assert.strictEqual(findServerBinary(path.join(root, 'missing')), null);
});

// ---------------------------------------------------------------------------
// Cleanup and summary
// ---------------------------------------------------------------------------
try {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
} catch {
  // Temporary directory cleanup is best-effort.
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  for (const failure of failures) {
    console.error(`\n${failure.name}\n${failure.error.stack}`);
  }
  process.exit(1);
}
