'use strict';

// In-browser-process ad blocker wired into Electron sessions.
// - Fetches and compiles EasyList-compatible filter lists asynchronously.
// - Never blocks the UI thread (list parsing is bounded and pattern-matching
//   runs only inside the onBeforeRequest callback context).
// - Maintains per-session blocked counters and a per-site protection
//   allowlist that the user controls.

const { net } = require('electron');
const { AdBlockFilterEngine } = require('../lib/adblock-engine');

const DEFAULT_LISTS = [
    {
        name: 'EasyList (ads, general)',
        url: 'https://easylist.to/easylist/easylist.txt',
    },
    {
        name: 'EasyPrivacy (trackers)',
        url: 'https://easylist.to/easylist/easyprivacy.txt',
    },
];

const UPDATE_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000; // every 4 days
const HARDENED_HOSTS = ['doubleclick.net', 'google-analytics.com', 'googlesyndication.com'];

class AdBlockManager {
    /**
     * @param {Electron.Session} session
     * @param {string} cacheDir directory for cached filter lists
     * @param {(status: object) => void} [onUpdate] called on every state change
     */
    constructor(session, cacheDir, onUpdate) {
        this.session = session;
        this.cacheDir = cacheDir;
        this.onUpdate = onUpdate;
        this.engine = new AdBlockFilterEngine();
        this.enabled = true;
        this.exemptHosts = new Set(); // user-disabled protection per site
        this.blockedTotal = 0;
        this.blockedByHost = {}; // small bounded map
        this.ranges = this._defaultPatterns();
        this._timer = null;
    }

    _defaultPatterns() {
        // Small always-on fallback set used until lists download, and usable
        // when the user disables list updates.
        const rules = HARDENED_HOSTS.map(h => `||${h}^`);
        rules.push('||adnxs.com^', '||taboola.com^', '||outbrain.com^', '||criteo.com^');
        return rules;
    }

    async start({ autoUpdate = true } = {}) {
        this._register();
        await this._loadCachedOrDownload();
        if (autoUpdate) {
            this._timer = setInterval(() => { this.updateLists().catch(() => {}); }, UPDATE_INTERVAL_MS);
            if (this._timer.unref) this._timer.unref();
        }
    }

    stop() { if (this._timer) clearInterval(this._timer); }

    _notify() { if (this.onUpdate) this.onUpdate(this.status()); }

    _register() {
        // Re-register on every (re)load; correct behaviour is that the newest
        // filter set replaces the old veto decisions for later requests.
        const hostExempt = this.exemptHosts;
        this.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
            if (!this.enabled || !this.engine.isReady()) { callback({}); return; }
            let host = '';
            try { host = new URL(details.url).hostname; } catch (e) { callback({}); return; }
            if (hostExempt.has(host) || hostExempt.has(this._baseDomain(host))) { callback({}); return; }
            const { blocked, rule } = this.engine.match(details.url);
            if (blocked) {
                this.blockedTotal++;
                this.blockedByHost[this._baseDomain(host)] = (this.blockedByHost[this._baseDomain(host)] || 0) + 1;
                if (Object.keys(this.blockedByHost).length > 200) {
                    // bound memory: drop the oldest half
                    const drop = Object.entries(this.blockedByHost).sort((a, b) => b[1] - a[1]).slice(100).map(e => e[0]);
                    for (const d of drop) delete this.blockedByHost[d];
                }
                this._notifyThrottled();
            }
            callback({ cancel: blocked });
        });
        this.session.webRequest.onBeforeRequest({ urls: this.ranges }, (details, callback) => {
            const { blocked } = this.engine.match(details.url);
            callback({ cancel: blocked && this.enabled });
        });
    }

    _notifyThrottled() {
        const now = Date.now();
        if (!this._lastNotify || now - this._lastNotify > 500) {
            this._lastNotify = now;
            this._notify();
        }
    }

    _baseDomain(host) {
        if (!host) return host;
        // pragmatic public-suffix approximation: keep last two labels,
        // expanding to three for common ccTLDs
        const parts = host.split('.');
        if (parts.length <= 2) return host;
        const two = parts.slice(-2).join('.');
        if (/^(co|com|net|org|gov|ac)\.(uk|nz|au|za|jp|bn|kr|tr|vn)$/.test(two)) {
            return parts.slice(-3).join('.');
        }
        return two;
    }

    _cachePath(list) {
        const safe = String(list.name).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        return require('path').join(this.cacheDir, safe + '.txt');
    }

    async _loadCachedOrDownload() {
        let loaded = 0;
        for (const list of DEFAULT_LISTS) {
            const p = this._cachePath(list);
            let text = null;
            try {
                const stat = require('fs').statSync(p);
                text = require('fs').readFileSync(p, 'utf8');
                // refresh if cache older than interval
                if (Date.now() - stat.mtimeMs > UPDATE_INTERVAL_MS) {
                    this._fetchList(list).catch(() => {});
                }
            } catch (e) {
                await this._fetchList(list).catch(() => {});
                try { text = require('fs').readFileSync(p, 'utf8'); } catch (e2) {}
            }
            if (text) loaded += this.engine.loadFromText(text);
        }
        this.lastLoadedRules = loaded;
        this._notify();
        return loaded;
    }

    _fetchList(list) {
        return new Promise((resolve, reject) => {
            const req = net.request(list.url);
            req.on('response', res => {
                if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
                let body = '';
                res.setEncoding('utf8');
                res.on('data', c => { body += c; if (body.length > 25 * 1024 * 1024) req.abort(); }); // 25MB cap: malicious-update bound
                res.on('end', () => {
                    try {
                        require('fs').writeFileSync(this._cachePath(list), body);
                        resolve(body);
                    } catch (e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.setTimeout(30000, () => { req.abort(); reject(new Error('timeout')); });
            req.end();
        });
    }

    /** Force re-download and recompile all lists. Returns compiled rule count. */
    async updateLists() {
        for (const list of DEFAULT_LISTS) {
            await this._fetchList(list).catch(() => {});
        }
        return this._loadCachedOrDownload();
    }

    status() {
        return {
            enabled: this.enabled,
            rules: this.engine.isReady() ? this.engine.ruleCount : 0,
            blockedTotal: this.blockedTotal,
            blockedByHost: this.blockedByHost,
            exemptHosts: [...this.exemptHosts],
            lastLoadedRules: this.lastLoadedRules || 0,
        };
    }

    setEnabled(v) { this.enabled = !!v; this._notify(); }

    setSiteExempt(host, exempt) {
        if (exempt) this.exemptHosts.add(host);
        else this.exemptHosts.delete(host);
        this._notify();
    }

    clearStats() { this.blockedTotal = 0; this.blockedByHost = {}; this._notify(); }
}

module.exports = { AdBlockManager };
