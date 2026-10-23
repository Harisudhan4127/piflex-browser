'use strict';

const fs = require('fs');
const path = require('path');
const { hostnameOf, isThirdParty } = require('../../../core/url');
const { AdBlockFilterEngine, normalizeResourceType } = require('../../../core/adblock/engine');
const {
  BUILTIN_EXTRA_FILTER_TEXT,
  FILTER_LISTS,
  FALLBACK_FILTER_TEXT,
  validateFilterText,
  listCacheName,
} = require('../../../core/adblock/lists');

const UPDATE_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * Network-level ad/tracker blocking. Rule compilation and matching happen in
 * the main process; nothing is loaded into web content.
 *
 * Honest scope: this blocks network requests only. It does not claim cosmetic
 * filtering, fingerprinting resistance, or HTTPS upgrading beyond what the
 * engine performs natively.
 */
class AdblockService {
  constructor({ session, settingsService, filtersDir, cacheDir, logger, net, onStats }) {
    this.session = session;
    this.settings = settingsService;
    this.filtersDir = filtersDir;
    this.cacheDir = cacheDir;
    this.logger = logger || { warn() {} };
    this.net = net;
    this.onStats = onStats || (() => {});
    this.engine = new AdBlockFilterEngine();
    this.rulesCount = 0;
    this.lastUpdated = 0;
    this.adsBlocked = 0;
    this.trackersBlocked = 0;
    this.since = Date.now();
    this.installed = false;
    this.updateTimer = null;
    this._byTab = new Map();
  }

  async init() {
    await this.loadRules();
    this.install();
    // First run: fetch the maintained lists in the background. The built-in
    // fallback is active immediately so blocking works even while offline.
    if (this.cachedLists === 0 && this._enabled()) {
      this.updateLists().catch((error) => this.logger.warn('Filter list download failed', error.message));
    }
    this.updateTimer = setInterval(() => this.updateLists().catch(() => {}), UPDATE_INTERVAL_MS);
    if (this.updateTimer.unref) this.updateTimer.unref();
  }

  _enabled() {
    const s = this.settings.get();
    return !!(s.privacy && s.privacy.adblock);
  }

  _exemptHosts() {
    const s = this.settings.get();
    return new Set((s.sites && s.sites.adblockExempt) || []);
  }

  async loadRules() {
    const s = this.settings.get();
    const enabledIds = (s.privacy && s.privacy.filterListIds) || ['easylist', 'easyprivacy'];
    this.engine = new AdBlockFilterEngine();
    const sources = [{ name: 'PiFlex built-in fixes', text: BUILTIN_EXTRA_FILTER_TEXT }];
    let newest = 0;
    let cachedLists = 0;
    for (const list of FILTER_LISTS) {
      if (!enabledIds.includes(list.id)) continue;
      const cachePath = path.join(this.filtersDir, listCacheName(list.id));
      try {
        if (fs.existsSync(cachePath)) {
          const text = fs.readFileSync(cachePath, 'utf8');
          if (validateFilterText(text).ok) {
            sources.push({ name: list.name, text });
            cachedLists += 1;
            newest = Math.max(newest, fs.statSync(cachePath).mtimeMs);
            continue;
          }
        }
      } catch (error) {
        this.logger.warn('Filter cache read failed', list.id, error.message);
      }
    }
    if (cachedLists === 0) {
      sources.push({ name: 'PiFlex fallback', text: FALLBACK_FILTER_TEXT });
    }
    // `load()` resets the engine, so every list must be compiled in one call.
    const stats = this.engine.load(sources);
    this.stats = stats;
    this.rulesCount = stats.networkRules;
    this.lastUpdated = newest || Date.now();
    this.cachedLists = cachedLists;
    this.logger.info(
      'Adblock rules loaded',
      stats.networkRules,
      'network /',
      stats.cosmeticRules,
      'cosmetic from',
      sources.length,
      'lists',
    );
    return stats;
  }

  async updateLists() {
    const s = this.settings.get();
    const enabledIds = (s.privacy && s.privacy.filterListIds) || [];
    if (enabledIds.length === 0) {
      // Still reload to ensure engine is in correct state
      await this.loadRules();
      return [];
    }
    const results = [];
    for (const list of FILTER_LISTS) {
      if (!enabledIds.includes(list.id)) continue;
      try {
        const text = await this._fetch(list.url);
        const check = validateFilterText(text);
        if (!check.ok) {
          results.push({ id: list.id, ok: false, reason: check.reason });
          continue;
        }
        try {
          fs.mkdirSync(this.filtersDir, { recursive: true });
        } catch {}
        fs.writeFileSync(path.join(this.filtersDir, listCacheName(list.id)), text);
        results.push({ id: list.id, ok: true });
      } catch (error) {
        results.push({ id: list.id, ok: false, reason: error.message });
      }
    }
    await this.loadRules();
    return results;
  }

  _fetch(url) {
    return new Promise((resolve, reject) => {
      const request = this.net.request({ method: 'GET', url });
      const chunks = [];
      let size = 0;
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          request.abort();
          return;
        }
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > 25 * 1024 * 1024) {
            reject(new Error('Filter list too large'));
            request.abort();
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        response.on('error', reject);
      });
      request.on('error', reject);
      request.end();
    });
  }

  install() {
    if (this.installed) return;
    this.installed = true;
    const filter = { urls: ['http://*/*', 'https://*/*'] };
    this.session.webRequest.onBeforeRequest(filter, (details, callback) => {
      try {
        callback({ cancel: this._shouldBlock(details) });
      } catch (error) {
        this.logger.warn('Adblock onBeforeRequest crashed', error.message);
        try {
          callback({ cancel: false });
        } catch {
          // ignore
        }
      }
    });
  }

  _shouldBlock(details) {
    try {
      if (!this._enabled()) return false;
      const url = details.url;
      const host = hostnameOf(url);
      if (!host) return false;

      // Never interfere with top-level document navigations. A canceled
      // request here surfaces to the user as ERR_FAILED (-2).
      if (!details.resourceType || details.resourceType === 'mainFrame') return false;

      const exempt = this._exemptHosts();
      if (exempt.has(host)) return false;

      // `@@` exception rules need the page that initiated the request. Electron
      // exposes it as `referrer` (and sometimes `documentUrl`).
      const documentUrl = details.documentUrl || details.referrer || '';

      const result = this.engine.match(url, {
        type: normalizeResourceType(details.resourceType),
        documentUrl,
      });
      if (!result || !result.blocked) return false;

      const thirdParty = documentUrl ? isThirdParty(url, documentUrl) : true;
      if (result.category === 'tracker' || thirdParty) this.trackersBlocked += 1;
      else this.adsBlocked += 1;
      this._byTab.set(details.webContentsId, (this._byTab.get(details.webContentsId) || 0) + 1);
      this._emitStats();
      return true;
    } catch (error) {
      // A throw inside a webRequest listener cancels the request in Electron.
      this.logger.warn('Adblock match failed', error.message);
      return false;
    }
  }

  _emitStats() {
    this.onStats(this.getStats());
  }

  getStats() {
    return {
      adsBlocked: this.adsBlocked,
      trackersBlocked: this.trackersBlocked,
      httpsUpgrades: 0,
      since: this.since,
      filterLists: (this.settings.get().privacy.filterListIds || []),
    };
  }

  statusFor(url) {
    const host = hostnameOf(url);
    const s = this.settings.get();
    const exempt = (s.sites.adblockExempt || []).includes(host);
    return {
      enabled: this._enabled(),
      filterLists: s.privacy.filterListIds || [],
      rulesCount: this.rulesCount,
      lastUpdated: this.lastUpdated,
      siteExempt: exempt,
    };
  }

  toggleSite(url, exempt) {
    const host = hostnameOf(url);
    if (!host) return null;
    this.settings.setAdblockExempt(host, exempt);
    return this.statusFor(url);
  }

  countersFor(tabId) {
    return this._byTab.get(tabId) || 0;
  }

  resetCounters() {
    this.adsBlocked = 0;
    this.trackersBlocked = 0;
    this.since = Date.now();
    this._byTab.clear();
    this._emitStats();
  }

  destroy() {
    if (this.updateTimer) clearInterval(this.updateTimer);
    try {
      this.session.webRequest.onBeforeRequest(null);
    } catch {
      // ignore
    }
  }
}

module.exports = { AdblockService, UPDATE_INTERVAL_MS };
