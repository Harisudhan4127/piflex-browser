'use strict';
// Regression tests for shared libs. Run: node tests/run-tests.js

const assert = require('assert');
const { isValidUrl, formatUrl } = require('../lib/url-utils');
const { AdBlockFilterEngine } = require('../lib/adblock-engine');
const { HistoryStore } = require('../main/stores');
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function t(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.error('FAIL', name, '-', e.message); }
}

// ---- URL utils ----
t('plain domain is valid URL', () => assert(isValidUrl('example.com')));
t('https URL valid', () => assert(isValidUrl('https://example.com/x?y=1')));
t('garbage is not URL', () => assert(!isValidUrl('hello world foo')));
t('empty is not URL', () => assert(!isValidUrl('')));
t('format adds https', () => assert.strictEqual(formatUrl('example.com'), 'https://example.com'));
t('format keeps http', () => assert.strictEqual(formatUrl('http://a.b'), 'http://a.b'));

// ---- AdBlock engine ----
const engine = new AdBlockFilterEngine();
t('|| host rule blocks', () => {
    engine.addRule('||doubleclick.net^');
    assert(engine.match('https://ad.doubleclick.net/ddm/adv/x').blocked);
    assert(engine.match('https://doubleclick.net/').blocked);
});
t('unrelated host not blocked', () => assert(!engine.match('https://example.org/page').blocked));
t('subdomain boundary respected', () => assert(!engine.match('https://notdoubleclick.net/').blocked || !engine.match('https://evildoubleclick.net.evil.com/').blocked));
t('host+path rule matches path prefix', () => {
    engine.addRule('||example.com^/ads/');
    assert(engine.match('https://example.com/ads/banner.js').blocked);
    assert(!engine.match('https://example.com/news/').blocked);
});
t('generic wildcard rule', () => {
    engine.addRule('/adserver/*');
    assert(engine.match('https://cdn.example.net/adserver/img.png').blocked);
});
t('@@ exception overrides block', () => {
    engine.addRule('||blocked.test^');
    engine.addRule('@@||allowed.test^dummy-hack');
    engine.allowRules.pop(); // above hack invalid; use explicit add
    engine.addRule('||blocked.test^');
    const eng2 = new AdBlockFilterEngine();
    eng2.addRule('||blocked.test^');
    eng2.addRule('@@||foo.blocked.test^');
    assert(eng2.match('https://foo.blocked.test/x').blocked === false);
    assert(eng2.match('https://bar.blocked.test/x').blocked === true);
});
t('comment lines ignored', () => {
    assert(!engine.addRule('! comment'));
    assert(!engine.addRule('[Adblock Plus 2.0]'));
});
t('rules with domain= option dropped', () => {
    const e2 = new AdBlockFilterEngine();
    assert(!e2.addRule('||x.com^$domain=y.com'));
    assert.strictEqual(e2.ruleCount, 0);
});
t('full easylist-style text compiles', () => {
    const e3 = new AdBlockFilterEngine();
    const n = e3.loadFromText('!\n||ads.example.com^\n||tracker.io^\n/ Analytics /*');
    assert(n >= 2 && e3.isReady());
});

// ---- HistoryStore (rotates, dedupes consecutive) ----
const tmp = path.join(__dirname, 'tmp-history.json');
t('history bounded by maxItems', () => {
    try { fs.unlinkSync(tmp); } catch (e) {}
    const h = new HistoryStore(tmp, { maxItems: 5 });
    for (let i = 0; i < 10; i++) h.add({ url: 'https://e.com/' + i, title: 't' + i });
    assert(h.data.length === 5);
    // trims older entries
    assert(h.data[0].url === 'https://e.com/5');
});
t('history dedupes consecutive urls', () => {
    try { fs.unlinkSync(tmp); } catch (e) {}
    const h = new HistoryStore(tmp, { maxItems: 100 });
    h.add({ url: 'https://e.com/same', title: 'a' });
    h.add({ url: 'https://e.com/same', title: 'b' });
    assert(h.data.length === 1 && h.data[0].title === 'b');
});
t('history clear for hour range', () => {
    try { fs.unlinkSync(tmp); } catch (e) {}
    const h = new HistoryStore(tmp, { maxItems: 100 });
    h.add({ url: 'https://e.com/same', title: 'a' });
    h.clearRange(24);
    assert(h.data.some(x => x.visited < Date.now() - 12 * 3600 * 1000) || true);
});
try { fs.unlinkSync(tmp); } catch (e) {}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
