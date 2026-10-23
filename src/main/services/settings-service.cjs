'use strict';

const { SettingsStore } = require('../../../core/stores/settings');
const { DEFAULT_SETTINGS, mergeKnown } = require('../../../core/settings-schema');

/**
 * Main-process settings facade. Wraps the JSON SettingsStore, exposes typed
 * get/update/reset and emits change events to interested services.
 */
class SettingsService {
  constructor(filePath, logger) {
    this.logger = logger || { warn() {} };
    this.listeners = new Set();
    try {
      this.store = new SettingsStore(filePath);
    } catch (error) {
      this.logger.warn('Settings load failed, using defaults', error.message);
      this.store = null;
    }
  }

  get() {
    return this.store ? this.store.get() : DEFAULT_SETTINGS;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(settings, changedKeys) {
    for (const fn of this.listeners) {
      try {
        fn(settings, changedKeys);
      } catch (error) {
        this.logger.warn('Settings listener failed', error.message);
      }
    }
  }

  update(patch) {
    if (!this.store) return DEFAULT_SETTINGS;
    const changedKeys = Object.keys(mergeKnown(this.get(), patch));
    const next = this.store.update(patch);
    this._emit(next, changedKeys);
    return next;
  }

  reset() {
    if (!this.store) return DEFAULT_SETTINGS;
    const next = this.store.reset();
    this._emit(next, ['*']);
    return next;
  }

  setPermission(origin, permission, decision) {
    if (!this.store) return DEFAULT_SETTINGS;
    return this.store.setPermission(origin, permission, decision);
  }

  setPrivacy(patch) {
    if (!this.store) return DEFAULT_SETTINGS;
    const next = this.store.setPrivacy(patch);
    this._emit(next, ['privacy']);
    return next;
  }

  setAdblockExempt(host, exempt) {
    if (!this.store) return DEFAULT_SETTINGS;
    return this.store.setSiteAdblockExempt(host, exempt);
  }
}

module.exports = { SettingsService };
