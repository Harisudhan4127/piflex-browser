'use strict';

// EasyList-compatible network and cosmetic filter engine.
//
// Design goals:
//  - Keep per-request work bounded: host-anchored rules use a suffix hash map,
//    generic rules use an Aho-Corasick keyword prefilter before running regex.
//  - Reject malformed, oversized, or potentially catastrophic rules instead of
//    letting a malicious filter list degrade the browser.
//  - No network/TLS interception. Rules only veto outgoing requests and inject
//    CSS for cosmetic hiding.

const { hostnameOf, isThirdParty, registrableDomain } = require('../url');

const MAX_LINE_LENGTH = 2048;
const MAX_RULES = 300000;
const MAX_REGEX_LENGTH = 300;
const MAX_ALWAYS_CANDIDATES = 4000;
const MAX_SELECTOR_LENGTH = 500;
const MAX_COSMETIC_RULES = 60000;

const RESOURCE_TYPES = new Set([
  'document',
  'subdocument',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'media',
  'websocket',
  'other',
]);

// Electron's webRequest `resourceType` vocabulary differs slightly from the
// Adblock filter vocabulary. Map it so type-scoped rules ($script, $image, …)
// actually apply.
const ELECTRON_TYPE_MAP = {
  mainFrame: 'document',
  subFrame: 'subdocument',
  stylesheet: 'stylesheet',
  script: 'script',
  image: 'image',
  font: 'font',
  object: 'object',
  xhr: 'xmlhttprequest',
  ping: 'ping',
  media: 'media',
  webSocket: 'websocket',
  other: 'other',
};

function normalizeResourceType(type) {
  const text = String(type || '').trim();
  const mapped = ELECTRON_TYPE_MAP[text] || text.toLowerCase();
  return RESOURCE_TYPES.has(mapped) ? mapped : 'other';
}

const TYPE_OPTIONS = {
  document: 'document',
  subdocument: 'subdocument',
  stylesheet: 'stylesheet',
  script: 'script',
  image: 'image',
  font: 'font',
  object: 'object',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  ping: 'ping',
  media: 'media',
  websocket: 'websocket',
  other: 'other',
  popup: 'popup',
};

const UNSUPPORTED_OPTIONS = new Set([
  'csp',
  'redirect',
  'redirect-rule',
  'removeparam',
  'queryprune',
  'replace',
  'urltransform',
  'webrtc',
  'permissions',
  'header',
  'elemhide',
  'generichide',
  'specifichide',
  'ghide',
  'shide',
  'ehide',
  'inline-script',
  'inline-font',
  'badfilter',
]);

const SEPARATOR = '(?:[^a-z0-9_\\-%.]|$)';

function escapeRegex(text) {
  return String(text).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function wildcardToRegex(pattern) {
  return String(pattern)
    .split('')
    .map((char) => {
      if (char === '*') return '.*';
      if (char === '^') return SEPARATOR;
      return escapeRegex(char);
    })
    .join('');
}

function domainMatches(host, pattern) {
  const h = String(host || '').toLowerCase();
  let p = String(pattern || '').trim().toLowerCase();
  if (!h || !p) return false;
  if (p.startsWith('*.')) p = p.slice(2);
  if (p.startsWith('.')) p = p.slice(1);
  if (!p) return false;
  return h === p || h.endsWith('.' + p);
}

function findOptionSeparator(line) {
  const index = line.lastIndexOf('$');
  if (index <= 0) return -1;
  const suffix = line.slice(index + 1);
  if (!suffix || suffix.length > 500) return -1;
  // Slashes indicate a regex rule (for example /foo$bar/) rather than options.
  if (suffix.includes('/') || suffix.includes('#') || suffix.includes('://')) return -1;
  return index;
}

function parseOptions(text) {
  const options = {
    types: null,
    notTypes: new Set(),
    thirdParty: null,
    domainsIn: [],
    domainsOut: [],
    important: false,
    matchCase: false,
  };
  if (!text) return { options, unsupported: false };
  for (const rawToken of text.split(',')) {
    const token = rawToken.trim().toLowerCase();
    if (!token) continue;
    if (token === 'important') {
      options.important = true;
      continue;
    }
    if (token === 'match-case') {
      options.matchCase = true;
      continue;
    }
    if (token === '~match-case') continue;
    if (token === 'third-party' || token === '3p') {
      options.thirdParty = true;
      continue;
    }
    if (token === '~third-party' || token === '~3p' || token === 'first-party' || token === '1p') {
      options.thirdParty = false;
      continue;
    }
    if (token.startsWith('domain=')) {
      for (const domain of token.slice(7).split('|')) {
        const value = domain.trim();
        if (!value) continue;
        if (value.startsWith('~')) options.domainsOut.push(value.slice(1));
        else options.domainsIn.push(value);
      }
      continue;
    }
    const negated = token.startsWith('~');
    const withoutTilde = negated ? token.slice(1) : token;
    const optionName = withoutTilde.split('=')[0];
    if (UNSUPPORTED_OPTIONS.has(optionName)) {
      return { options, unsupported: true };
    }
    const mapped = TYPE_OPTIONS[withoutTilde];
    const name = withoutTilde;
    if (mapped) {
      if (negated) {
        options.notTypes.add(mapped);
      } else {
        if (!options.types) options.types = new Set();
        options.types.add(mapped);
      }
      continue;
    }
    // Unknown modifiers are treated as unsupported rather than blocking more
    // traffic than the list author intended.
    return { options, unsupported: true };
  }
  return { options, unsupported: false };
}

function longestKeyword(pattern) {
  const matches = String(pattern).toLowerCase().match(/[a-z0-9]{4,}/g);
  if (!matches) return '';
  let best = '';
  for (const match of matches) {
    if (match.length > best.length) best = match;
  }
  return best.length >= 4 ? best : '';
}

class AhoCorasick {
  constructor() {
    this.root = { next: new Map(), fail: null, out: [] };
    this.built = false;
    this.size = 0;
  }

  add(keyword, index) {
    const key = String(keyword || '').toLowerCase();
    if (!key) return;
    let node = this.root;
    for (const char of key) {
      let next = node.next.get(char);
      if (!next) {
        next = { next: new Map(), fail: null, out: [] };
        node.next.set(char, next);
      }
      node = next;
    }
    if (!node.out.includes(index)) node.out.push(index);
    this.size++;
  }

  build() {
    const queue = [];
    for (const child of this.root.next.values()) {
      child.fail = this.root;
      queue.push(child);
    }
    while (queue.length) {
      const node = queue.shift();
      for (const [char, child] of node.next) {
        let fail = node.fail;
        while (fail && !fail.next.has(char)) fail = fail.fail;
        child.fail = fail && fail.next.has(char) ? fail.next.get(char) : this.root;
        if (child.fail.out.length) child.out = child.out.concat(child.fail.out);
        queue.push(child);
      }
    }
    this.built = true;
  }

  search(text) {
    if (!this.built) this.build();
    const result = new Set();
    let node = this.root;
    const value = String(text || '').toLowerCase();
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      while (node !== this.root && !node.next.has(char)) node = node.fail;
      node = node.next.get(char) || this.root;
      if (node.out.length) {
        for (const index of node.out) result.add(index);
      }
    }
    return result;
  }
}

class AdBlockFilterEngine {
  constructor() {
    this.clear();
  }

  clear() {
    this.rules = [];
    this.hostIndex = new Map();
    this.keywordIndex = new AhoCorasick();
    this.alwaysCandidates = [];
    this.cosmetic = { global: [], byDomain: new Map(), globalExceptions: new Set() };
    this.networkRuleCount = 0;
    this.cosmeticRuleCount = 0;
    this.skippedRules = 0;
    this.ready = false;
    this.sources = [];
  }

  isReady() {
    return this.ready && this.networkRuleCount > 0;
  }

  get ruleCount() {
    return this.networkRuleCount + this.cosmeticRuleCount;
  }

  _addCosmetic(line, allow) {
    const hash = line.indexOf('#@#');
    const sep = allow ? '#@#' : '##';
    const index = line.indexOf(sep);
    if (index === -1) return false;
    const domainPart = line.slice(0, index).trim();
    const selector = line.slice(index + sep.length).trim();
    if (!selector || selector.length > MAX_SELECTOR_LENGTH) return false;
    if (/[{}@<>;]|\\|url\s*\(|expression\s*\(|javascript:/i.test(selector)) return false;
    if (/^[#+^]/.test(selector) || /\bjs\s*\(/i.test(selector)) return false;

    const domainsIn = [];
    const domainsOut = [];
    if (domainPart) {
      for (const raw of domainPart.split(',')) {
        const domain = raw.trim().toLowerCase();
        if (!domain) continue;
        if (!/^~?[a-z0-9.*-]+$/i.test(domain)) return false;
        if (domain.startsWith('~')) domainsOut.push(domain.slice(1));
        else domainsIn.push(domain);
      }
    }

    if (allow) {
      if (!domainsIn.length && !domainsOut.length) {
        this.cosmetic.globalExceptions.add(selector);
      } else {
        const key = domainsIn.length ? domainsIn[0] : '*';
        if (!this.cosmetic.byDomain.has(key)) {
          this.cosmetic.byDomain.set(key, { hide: [], allow: [] });
        }
        this.cosmetic.byDomain.get(key).allow.push({ domainsIn, domainsOut, selector });
      }
    } else {
      if (!domainsIn.length && !domainsOut.length) {
        this.cosmetic.global.push(selector);
      } else {
        const key = domainsIn.length ? domainsIn[0] : '*';
        if (!this.cosmetic.byDomain.has(key)) {
          this.cosmetic.byDomain.set(key, { hide: [], allow: [] });
        }
        this.cosmetic.byDomain.get(key).hide.push({ domainsIn, domainsOut, selector });
      }
    }
    this.cosmeticRuleCount++;
    return true;
  }

  _addNetwork(line) {
    let source = line;
    let allow = false;
    let important = false;

    if (source.startsWith('@@')) {
      allow = true;
      source = source.slice(2);
    }

    const separator = findOptionSeparator(source);
    let optionText = '';
    if (separator !== -1) {
      optionText = source.slice(separator + 1);
      source = source.slice(0, separator);
    }

    const { options, unsupported } = parseOptions(optionText);
    if (unsupported) return false;
    important = options.important;

    if (!source || source.length < 3) return false;
    if (/^[|/]?[\w-]+:\/\//i.test(source)) {
      // Absolute rules are valid, but javascript/data rules are not useful for
      // network blocking and could be dangerous to translate.
      if (!/^https?:\/\//i.test(source.replace(/^\|/, ''))) return false;
    }

    let regex = null;
    let hostSuffix = null;
    let pathRegex = null;
    let keyword = '';

    if (source.startsWith('/') && source.endsWith('/') && source.length > 2) {
      const body = source.slice(1, -1);
      if (body.length > MAX_REGEX_LENGTH) return false;
      if (/\((?:[^)]*[+*][^)]*)\)[+*]/.test(body)) return false;
      try {
        regex = new RegExp(body, options.matchCase ? '' : 'i');
      } catch {
        return false;
      }
      keyword = longestKeyword(body);
    } else {
      let pattern = source;
      let leftAnchor = false;
      if (pattern.startsWith('|') && !pattern.startsWith('||')) {
        leftAnchor = true;
        pattern = pattern.slice(1);
      }

      if (pattern.startsWith('||')) {
        pattern = pattern.slice(2);
        const slashIndex = pattern.indexOf('/');
        let hostPart = slashIndex === -1 ? pattern : pattern.slice(0, slashIndex);
        const pathPart = slashIndex === -1 ? '' : pattern.slice(slashIndex);
        hostPart = hostPart.replace(/\^$/, '');

        const simpleHost = /^[a-z0-9.-]+$/i.test(hostPart) && !hostPart.includes(':');
        if (simpleHost) {
          hostSuffix = hostPart.toLowerCase().replace(/^\.+|\.+$/g, '');
          const cleanedPath = pathPart.replace(/\^/g, '*').replace(/\*$/, '');
          if (cleanedPath && cleanedPath.length > 1) {
            try {
              pathRegex = new RegExp('^' + wildcardToRegex(cleanedPath), options.matchCase ? '' : 'i');
            } catch {
              return false;
            }
          }
          if (pathPart.endsWith('|')) {
            // handled by path regex ending below
            const anchored = pathPart.slice(0, -1);
            try {
              pathRegex = new RegExp('^' + wildcardToRegex(anchored) + '$', options.matchCase ? '' : 'i');
            } catch {
              return false;
            }
          }
        } else {
          let hostPattern = hostPart.replace(/^\.+|\.+$/g, '');
          hostPattern = hostPattern.replace(/\^/g, '');
          let body = '(?:[^/?#]+\\.)?' + wildcardToRegex(hostPattern);
          if (pathPart) body += wildcardToRegex(pathPart);
          body += '(?:[#?]|$)';
          if (body.length > MAX_REGEX_LENGTH) return false;
          try {
            regex = new RegExp('^(?:https?|wss?):\\/\\/' + body, options.matchCase ? '' : 'i');
          } catch {
            return false;
          }
          keyword = longestKeyword(hostPattern);
        }
      } else {
        let rightAnchored = false;
        if (pattern.endsWith('|')) {
          rightAnchored = true;
          pattern = pattern.slice(0, -1);
        }
        const body = wildcardToRegex(pattern);
        if (body.length > MAX_REGEX_LENGTH) return false;
        const prefix = leftAnchor ? '^' : '';
        const suffix = rightAnchored ? '$' : '';
        try {
          regex = new RegExp(prefix + body + suffix, options.matchCase ? '' : 'i');
        } catch {
          return false;
        }
        keyword = longestKeyword(pattern);
      }
    }

    if (!regex && !hostSuffix) return false;

    const rule = {
      raw: line.slice(0, 512),
      allow,
      important,
      options,
      hostSuffix,
      pathRegex,
      regex,
      matchCase: options.matchCase,
    };

    const index = this.rules.length;
    this.rules.push(rule);
    this.networkRuleCount++;

    if (hostSuffix) {
      if (!this.hostIndex.has(hostSuffix)) this.hostIndex.set(hostSuffix, []);
      this.hostIndex.get(hostSuffix).push(index);
    } else if (keyword) {
      this.keywordIndex.add(keyword, index);
    } else if (this.alwaysCandidates.length < MAX_ALWAYS_CANDIDATES) {
      this.alwaysCandidates.push(index);
    } else {
      this.skippedRules++;
      this.networkRuleCount--;
      this.rules.pop();
    }
    return true;
  }

  /**
   * Compile one or more filter lists.
   * @param {Array<{name:string,text:string}>|string} input
   */
  load(input) {
    this.clear();
    const sources = Array.isArray(input) ? input : [{ name: 'inline', text: String(input || '') }];
    for (const source of sources) {
      const name = String(source.name || 'filter list').slice(0, 120);
      this.sources.push(name);
      const lines = String(source.text || '').split(/\r?\n/);
      for (const rawLine of lines) {
        if (this.rules.length >= MAX_RULES) break;
        const line = rawLine.trim();
        if (!line || line.startsWith('!') || line.startsWith('[')) continue;
        if (line.length > MAX_LINE_LENGTH) {
          this.skippedRules++;
          continue;
        }
        if (/^[^#]*#(?:@?|\?|%|\$)|\$#/.test(line) && !line.includes('$redirect')) {
          if (line.includes('#@#') || line.includes('##') || line.includes('#?#') || line.includes('#$#')) {
            if (line.includes('#?#') || line.includes('#$#') || line.includes('#%#')) {
              this.skippedRules++;
              continue;
            }
            if (this.cosmeticRuleCount < MAX_COSMETIC_RULES) {
              const allow = line.includes('#@#');
              if (!this._addCosmetic(line, allow)) this.skippedRules++;
            }
            continue;
          }
        }
        try {
          if (!this._addNetwork(line)) this.skippedRules++;
        } catch {
          this.skippedRules++;
        }
      }
    }
    this.keywordIndex.build();
    this.ready = this.networkRuleCount > 0;
    this.rules = this.rules.slice(0, this.rules.length);
    return this.stats();
  }

  _domainsApply(rule, host) {
    const { domainsIn, domainsOut } = rule.options;
    if (domainsOut.some((pattern) => domainMatches(host, pattern))) return false;
    if (domainsIn.length) return domainsIn.some((pattern) => domainMatches(host, pattern));
    return true;
  }

  _ruleMatches(rule, url, urlLower, context) {
    const { type, documentUrl } = context;
    const opts = rule.options;

    if (opts.types && !opts.types.has(type)) return false;
    if (opts.notTypes.size && opts.notTypes.has(type)) return false;

    if (opts.thirdParty === true && !isThirdParty(url, documentUrl)) return false;
    if (opts.thirdParty === false && isThirdParty(url, documentUrl)) return false;

    if (opts.domainsIn.length || opts.domainsOut.length) {
      const docHost = hostnameOf(documentUrl);
      if (!docHost || !this._domainsApply(rule, docHost)) return false;
    }

    if (rule.hostSuffix) {
      const host = hostnameOf(url);
      if (!host) return false;
      if (host !== rule.hostSuffix && !host.endsWith('.' + rule.hostSuffix)) return false;
      if (rule.pathRegex) {
        try {
          const parsed = new URL(url);
          if (!rule.pathRegex.test(parsed.pathname + parsed.search)) return false;
        } catch {
          return false;
        }
      }
      return true;
    }

    if (rule.regex) {
      return rule.regex.test(rule.matchCase ? url : urlLower);
    }
    return false;
  }

  /**
   * @param {string} url
   * @param {{type?:string, documentUrl?:string}} [context]
   */
  match(url, context = {}) {
    if (!this.ready) return { blocked: false, rule: null };
    let parsed;
    try {
      parsed = new URL(String(url));
    } catch {
      return { blocked: false, rule: null };
    }
    if (!/^(https?|wss?):$/i.test(parsed.protocol)) {
      return { blocked: false, rule: null };
    }

    const type = RESOURCE_TYPES.has(context.type) ? context.type : 'other';
    const documentUrl = context.documentUrl || '';
    const urlLower = parsed.href.toLowerCase();
    const host = parsed.hostname.toLowerCase();

    const candidates = new Set();
    const labels = host.split('.');
    for (let i = 0; i < labels.length - 1; i++) {
      const suffix = labels.slice(i).join('.');
      const list = this.hostIndex.get(suffix);
      if (list) for (const index of list) candidates.add(index);
    }
    for (const index of this.keywordIndex.search(urlLower)) candidates.add(index);
    for (const index of this.alwaysCandidates) candidates.add(index);

    let allow = null;
    let normalBlock = null;
    let importantBlock = null;

    for (const index of candidates) {
      const rule = this.rules[index];
      if (!rule) continue;
      if (!this._ruleMatches(rule, parsed.href, urlLower, { type, documentUrl })) continue;
      if (rule.allow) {
        if (!allow) allow = rule;
      } else if (rule.important) {
        if (!importantBlock) importantBlock = rule;
      } else if (!normalBlock) {
        normalBlock = rule;
      }
      if (importantBlock) break;
    }

    if (importantBlock) return { blocked: true, rule: importantBlock.raw, important: true };
    if (allow) return { blocked: false, rule: allow.raw, allowed: true };
    if (normalBlock) return { blocked: true, rule: normalBlock.raw };
    return { blocked: false, rule: null };
  }

  getCosmeticSelectors(host) {
    const value = String(host || '').toLowerCase();
    const selected = new Set(this.cosmetic.global);
    const exceptions = new Set(this.cosmetic.globalExceptions);

    for (const entry of this.cosmetic.byDomain.values()) {
      for (const rule of entry.hide) {
        if (this._cosmeticDomainApplies(rule, value)) selected.add(rule.selector);
      }
      for (const rule of entry.allow) {
        if (this._cosmeticDomainApplies(rule, value)) exceptions.add(rule.selector);
      }
    }
    for (const selector of exceptions) selected.delete(selector);
    return [...selected];
  }

  _cosmeticDomainApplies(rule, host) {
    if (rule.domainsOut.some((pattern) => domainMatches(host, pattern))) return false;
    if (rule.domainsIn.length) return rule.domainsIn.some((pattern) => domainMatches(host, pattern));
    return true;
  }

  stats() {
    return {
      networkRules: this.networkRuleCount,
      cosmeticRules: this.cosmeticRuleCount,
      totalRules: this.ruleCount,
      skippedRules: this.skippedRules,
      sources: this.sources.slice(),
      ready: this.ready,
    };
  }
}

module.exports = {
  AdBlockFilterEngine,
  AhoCorasick,
  domainMatches,
  normalizeResourceType,
  registrableDomain,
};
