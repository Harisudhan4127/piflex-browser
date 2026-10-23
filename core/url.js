'use strict';

// Pure URL/navigation helpers shared by the main process, renderer and tests.
// No Electron or DOM dependencies.

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;
const HTTP_SCHEMES = new Set(['http:', 'https:']);
const FILE_SCHEMES = new Set(['file:']);
const INTERNAL_SCHEMES = new Set(['piflex:']);
const BLOCKED_SCHEMES = new Set([
  'javascript:',
  'vbscript:',
  'data:',
  'blob:',
  'filesystem:',
  'about:',
  'chrome:',
  'devtools:',
  'view-source:',
]);

const DOMAIN_RE =
  /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,62})?\.)+[\p{L}\p{N}-]{2,63}(?::\d{1,5})?(?:[/?#].*)?$/u;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:[/?#].*)?$/;
const IPV6_RE = /^\[[0-9a-f:.]+\](?::\d{1,5})?(?:[/?#].*)?$/i;
const LOCALHOST_RE = /^localhost(?::\d{1,5})?(?:[/?#].*)?$/i;

function trimInput(input) {
  return String(input == null ? '' : input)
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
}

function schemeOf(value) {
  const text = trimInput(value);
  const match = SCHEME_RE.exec(text);
  if (!match) return null;
  const rest = text.slice(match[0].length);
  // "localhost:3000" and "example.com:8080" are host:port inputs, not schemes.
  if (rest && !rest.startsWith('//') && /^\d/.test(rest)) return null;
  return match[1].toLowerCase() + ':';
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return HTTP_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

function isProbablyHost(input) {
  const value = trimInput(input);
  if (!value || /\s/.test(value)) return false;
  if (value.startsWith('/') || value.startsWith('.')) return false;
  if (LOCALHOST_RE.test(value) || IPV4_RE.test(value) || IPV6_RE.test(value)) {
    return true;
  }
  if (!value.includes('.')) return false;
  return DOMAIN_RE.test(value);
}

function normalizeSchemeUrl(value) {
  try {
    const url = new URL(value);
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Classify raw address-bar input.
 * @returns {{kind:'empty'|'url'|'search'|'blocked', url?:string, reason?:string, value:string}}
 */
function classifyInput(input) {
  const value = trimInput(input);
  if (!value) return { kind: 'empty', value };

  const scheme = schemeOf(value);
  if (scheme) {
    if (BLOCKED_SCHEMES.has(scheme)) {
      return {
        kind: 'blocked',
        value,
        reason: `The ${scheme.replace(':', '')} scheme is not allowed in the address bar.`,
      };
    }
    if (HTTP_SCHEMES.has(scheme) || FILE_SCHEMES.has(scheme) || INTERNAL_SCHEMES.has(scheme)) {
      const normalized = normalizeSchemeUrl(value);
      if (!normalized) {
        return { kind: 'search', value };
      }
      return { kind: 'url', value, url: normalized };
    }
    // Unknown external scheme (mailto:, magnet:, custom app). Do not navigate
    // automatically; the UI offers an explicit external-open action instead.
    return {
      kind: 'blocked',
      value,
      reason: `The ${scheme.replace(':', '')} scheme requires an external application.`,
    };
  }

  if (isProbablyHost(value)) {
    const lower = value.toLowerCase();
    const useHttp = LOCALHOST_RE.test(lower) || IPV4_RE.test(lower) || IPV6_RE.test(lower);
    const url = normalizeSchemeUrl(`${useHttp ? 'http' : 'https'}://${value}`);
    if (url) return { kind: 'url', value, url };
  }

  return { kind: 'search', value };
}

function replaceQuery(template, query) {
  const encoded = encodeURIComponent(query);
  const tpl = String(template || '');
  if (tpl.includes('{query}')) return tpl.split('{query}').join(encoded);
  return tpl + encoded;
}

function hostnameOf(value) {
  try {
    return new URL(String(value)).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function originOf(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol === 'file:') return 'file://';
    return url.origin;
  } catch {
    return '';
  }
}

function displayHost(value) {
  const host = hostnameOf(value);
  if (!host) return '';
  return host.startsWith('www.') ? host.slice(4) : host;
}

function securityState(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return { level: 'unknown', label: 'Unknown' };
  }
  if (url.protocol === 'https:') return { level: 'secure', label: 'Secure connection (HTTPS)' };
  if (url.protocol === 'http:') return { level: 'insecure', label: 'Not secure (HTTP)' };
  if (url.protocol === 'file:') return { level: 'local', label: 'Local file' };
  if (url.protocol === 'piflex:') return { level: 'internal', label: 'PiFlex page' };
  return { level: 'unknown', label: url.protocol.replace(':', '') };
}

/**
 * Decide if a navigation is permitted for the top-level frame.
 * @param {string} target
 * @param {string} [currentUrl]
 */
function isAllowedTopLevelNavigation(target, currentUrl) {
  const scheme = schemeOf(target);
  if (!scheme) return false;
  if (HTTP_SCHEMES.has(scheme)) return true;
  if (INTERNAL_SCHEMES.has(scheme)) return true;
  if (FILE_SCHEMES.has(scheme)) {
    const currentScheme = schemeOf(currentUrl);
    if (!currentUrl) return true;
    return currentScheme === 'file:' || currentScheme === 'piflex:';
  }
  return false;
}

function isSafeExternalUrl(value) {
  return isHttpUrl(value);
}

function sameSite(a, b) {
  const ha = hostnameOf(a);
  const hb = hostnameOf(b);
  if (!ha || !hb) return false;
  return registrableDomain(ha) === registrableDomain(hb);
}

const MULTI_PART_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'co.jp',
  'co.kr',
  'com.br',
  'com.cn',
  'com.tr',
  'co.za',
  'co.in',
  'com.mx',
  'co.id',
  'com.sg',
]);

function registrableDomain(host) {
  const value = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!value || IPV4_RE.test(value) || value.includes(':') || value.startsWith('[')) {
    return value;
  }
  const parts = value.split('.');
  if (parts.length <= 2) return value;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

function isThirdParty(requestUrl, documentUrl) {
  const requestHost = hostnameOf(requestUrl);
  const docHost = hostnameOf(documentUrl);
  if (!requestHost || !docHost) return false;
  return registrableDomain(requestHost) !== registrableDomain(docHost);
}

function truncate(value, max) {
  const text = String(value == null ? '' : value);
  return text.length > max ? text.slice(0, max) : text;
}

module.exports = {
  BLOCKED_SCHEMES,
  classifyInput,
  displayHost,
  hostnameOf,
  isAllowedTopLevelNavigation,
  isHttpUrl,
  isProbablyHost,
  isSafeExternalUrl,
  isThirdParty,
  originOf,
  registrableDomain,
  replaceQuery,
  sameSite,
  schemeOf,
  securityState,
  trimInput,
  truncate,
};
