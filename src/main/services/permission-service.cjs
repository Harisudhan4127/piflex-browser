'use strict';

const { hostnameOf, originOf } = require('../../../core/url');

// Permissions we surface in the UI. Anything else is denied by default.
const SUPPORTED = new Set([
  'media',
  'geolocation',
  'notifications',
  'clipboard-read',
  'clipboard-sanitized-write',
  'midi',
  'midiSysex',
  'fullscreen',
  'openExternal',
]);

// Sensitive permissions that are never auto-granted and require an explicit
// user decision every session (no persistent allow).
const ALWAYS_ASK = new Set(['media', 'geolocation', 'midiSysex']);

/**
 * Bridges Electron's permission API to an in-app prompt. Decisions can be
 * remembered per-origin in settings.
 */
class PermissionService {
  constructor({ settingsService, logger }) {
    this.settings = settingsService;
    this.logger = logger || { warn() {} };
    this.attached = new WeakSet();
    this.pending = new Map();
    this.askRenderer = null;
  }

  onRequest(fn) {
    this.askRenderer = fn;
  }

  attach(session) {
    if (this.attached.has(session)) return;
    this.attached.add(session);
    session.setPermissionRequestHandler((webContents, permission, callback, details) => {
      this._handleRequest(webContents, permission, details).then(callback).catch(() => callback(false));
    });
    session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      return this._check(permission, requestingOrigin);
    });
  }

  _override(origin, permission) {
    const overrides = (this.settings.get().sites && this.settings.get().sites.permissionOverrides) || {};
    const record = overrides[origin];
    return record && record[permission] ? record[permission] : null;
  }

  _check(permission, origin) {
    if (!SUPPORTED.has(permission)) return false;
    if (ALWAYS_ASK.has(permission)) {
      // Checks are synchronous capability probes; do not grant without a prompt.
      return this._override(origin, permission) === 'allow';
    }
    const decision = this._override(origin, permission);
    return decision === 'allow';
  }

  async _handleRequest(webContents, permission, details) {
    if (!SUPPORTED.has(permission)) return false;
    const origin = originOf(details && details.requestingUrl ? details.requestingUrl : webContents.getURL());
    if (!origin) return false;

    const remembered = this._override(origin, permission);
    if (remembered === 'allow' || remembered === 'deny') return remembered === 'allow';

    if (!this.askRenderer) return false;
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const decision = await new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.askRenderer({
        id,
        origin,
        permission,
        detail: details && details.mediaTypes ? details.mediaTypes.join(', ') : undefined,
      });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve({ allow: false, remember: false });
        }
      }, 45000);
    });

    if (decision.remember) {
      this.settings.setPermission(origin, permission, decision.allow ? 'allow' : 'deny');
    }
    return !!decision.allow;
  }

  respond(id, { allow, remember }) {
    const resolve = this.pending.get(id);
    if (!resolve) return false;
    this.pending.delete(id);
    resolve({ allow: !!allow, remember: !!remember });
    return true;
  }

  list() {
    const overrides = (this.settings.get().sites && this.settings.get().sites.permissionOverrides) || {};
    const out = [];
    for (const [origin, record] of Object.entries(overrides)) {
      for (const [permission, decision] of Object.entries(record)) {
        out.push({ origin, permission, decision });
      }
    }
    return out;
  }

  set(origin, permission, decision) {
    if (!SUPPORTED.has(permission)) return null;
    this.settings.setPermission(origin, permission, decision);
    return { origin, permission, decision };
  }

  clear(origin, permission) {
    if (origin && permission) this.settings.setPermission(origin, permission, null);
    else if (origin) {
      const overrides = this.settings.get().sites.permissionOverrides[origin] || {};
      for (const name of Object.keys(overrides)) this.settings.setPermission(origin, name, null);
    }
    return this.list();
  }

  hostFor(url) {
    return hostnameOf(url);
  }
}

module.exports = { PermissionService, SUPPORTED, ALWAYS_ASK };
