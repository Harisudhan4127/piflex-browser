'use strict';

const { JsonStore } = require('./json-store');
const { DEFAULT_SETTINGS, normalizeSettings, mergeKnown } = require('../settings-schema');

class SettingsStore extends JsonStore {
  constructor(filePath, options = {}) {
    super(filePath, {
      defaultValue: DEFAULT_SETTINGS,
      debounceMs: 50,
      legacyPaths: options.legacyPaths || [],
      sanitize: normalizeSettings,
    });
    this.data = normalizeSettings(this.data);
  }

  get() {
    return this.data;
  }

  update(patch) {
    const merged = mergeKnown(this.data, patch);
    this.data = normalizeSettings(merged);
    this.scheduleSave();
    return this.data;
  }

  replace(raw) {
    this.data = normalizeSettings(raw);
    this.scheduleSave();
    return this.data;
  }

  reset() {
    this.data = normalizeSettings(DEFAULT_SETTINGS);
    this.scheduleSave();
    return this.data;
  }

  setPermission(origin, permission, decision) {
    const overrides = this.data.sites.permissionOverrides;
    const current = overrides[origin] && typeof overrides[origin] === 'object' ? overrides[origin] : {};
    if (decision === 'allow' || decision === 'deny') current[permission] = decision;
    else delete current[permission];
    overrides[origin] = current;
    if (!Object.keys(current).length) delete overrides[origin];
    this.scheduleSave();
    return this.data;
  }

  setPrivacy(patch) {
    const privacy = { ...this.data.privacy, ...(patch || {}) };
    this.data = normalizeSettings({ ...this.data, privacy });
    this.scheduleSave();
    return this.data;
  }

  setSiteAdblockExempt(host, exempt) {
    const list = new Set(this.data.sites.adblockExempt);
    if (exempt) list.add(String(host).toLowerCase());
    else list.delete(String(host).toLowerCase());
    this.data.sites.adblockExempt = [...list].slice(0, 500);
    this.scheduleSave();
    return this.data;
  }
}

module.exports = { SettingsStore };
