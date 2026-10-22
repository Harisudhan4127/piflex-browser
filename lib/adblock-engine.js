'use strict';

// Lightweight ad/tracker block engine.
//
// Supports a practical subset of EasyList-style network rules:
//   ||example.com^            -> match any subdomain of example.com
//   ||example.com^/path       -> match subdomain + path prefix
//   example.com/ad*           -> generic pattern with wildcards
//   /ads/*                    -> generic path pattern (any host)
//   @@||example.com^          -> exception (allowlist) rule
// Rules carrying unsupported options ($script, $third-party, $image, etc.)
// are treated as blocking rules on their URL part only; domain=, csp=
// and other unsupported modifiers cause the rule to be ignored safely.
//
// This is network-request-level blocking only. It does not touch TLS or
// act as a proxy — it vetoes outgoing requests in the browser process.

class AdBlockFilterEngine {
    constructor() {
        this.blockRules = [];
        this.allowRules = [];
        this.ruleCount = 0;
    }

    // Returns true if the text was recognized as a usable filter line.
    addRule(raw) {
        let line = String(raw || '').trim();
        if (!line || line.startsWith('!') || line.startsWith('[')) return false;

        // Strip unsupported non-URL options; keep rule only when option list
        // is empty or contains understood/neutral values.
        const dollar = line.lastIndexOf('$');
        const hasOptions = dollar !== -1 && (line.includes('||') || dollar > line.length - 60);
        if (hasOptions) {
            // has options section
            const options = line.slice(dollar + 1).toLowerCase();
            const urlPart = line.slice(0, dollar);
            if (options.includes('domain=') || options.includes('csp') || options.includes(' Cipher'.toLowerCase())) return false;
            if (options.split(',').every(o => ['script', 'image', 'stylesheet', 'third-party', 'subdocument', 'xmlhttprequest', 'popup', 'media', 'font'].some(k => o.includes(k)))) {
                line = urlPart; // keep, treat as plain URL match
            }
        }

        let allow = false;
        if (line.startsWith('@@')) {
            allow = true;
            line = line.slice(2);
        }
        if (!line || line.length < 3) return false;

        const compiled = this._compile(line);
        if (!compiled) return false;
        (allow ? this.allowRules : this.blockRules).push(compiled);
        this.ruleCount++;
        return true;
    }

    _compile(pattern) {
        let hostAnchor = false;
        if (pattern.startsWith('||')) {
            hostAnchor = true;
            pattern = pattern.slice(2);
        }
        // Strip trailing anchors; map mid-pattern separator '^' to '/' so
        // host/path splitting stays intact.
        pattern = pattern.replace(/\^$/, '').replace(/^\|/, '').replace(/\^/g, '');
        if (hostAnchor) {
            // Split into host part and optional path part at first '/'.
            const slash = pattern.indexOf('/');
            let host, path;
            if (slash === -1) { host = pattern; path = null; }
            else { host = pattern.slice(0, slash); path = pattern.slice(slash); }
            if (!host || /[^a-z0-9.*\-\[\]:]/i.test(host)) return null;
            return {
                type: 'host',
                host: host.replace(/\./g, '\\.').replace(/\*/g, '[^\\s.]*\\.'),
                // Path here is compared with plain startsWith, so store raw
                // text with only '*' wildcard resolution.
                path: path ? path.replace(/\*/g, '.*') : null,
            };
        }
        // Generic substring/wildcard rule.
        if (pattern.length < 2) return null;
        const re = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        // Don't compile overly broad single-fragment rules.
        if (re === '.*' || re === '') return null;
        return { type: 'generic', re };
    }

    _matchHostRule(rule, hostname, urlPath) {
        const hostRe = new RegExp(`(^|\\.)${rule.host}$`, 'i');
        if (!hostRe.test(hostname)) return false;
        if (rule.path) return urlPath.startsWith(rule.path);
        return true;
    }

    // Returns { blocked, rule } for a URL string.
    match(url) {
        let u;
        try { u = new URL(url); } catch (e) { return { blocked: false, rule: null }; }
        const hostname = u.hostname;
        const path = u.pathname + u.search;
        for (const r of this.allowRules) {
            if (r.type === 'host' ? this._matchHostRule(r, hostname, path)
                : new RegExp(r.re, 'i').test(url)) {
                return { blocked: false, rule: '@@' };
            }
        }
        for (const r of this.blockRules) {
            if (r.type === 'host' ? this._matchHostRule(r, hostname, path)
                : new RegExp(r.re, 'i').test(url)) {
                return { blocked: true, rule: r.type === 'host' ? '||' + r.host : r.re.slice(0, 40) };
            }
        }
        return { blocked: false, rule: null };
    }

    clear() {
        this.blockRules = [];
        this.allowRules = [];
        this.ruleCount = 0;
    }

    // Parse full EasyList-formatted text.
    loadFromText(text) {
        this.clear();
        const lines = String(text).split(/\r?\n/);
        for (const l of lines) this.addRule(l);
        return this.ruleCount;
    }

    isReady() { return this.ruleCount > 0; }
}

module.exports = { AdBlockFilterEngine };
