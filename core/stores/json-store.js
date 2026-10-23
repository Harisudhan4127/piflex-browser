'use strict';

const fs = require('fs');
const path = require('path');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class JsonStore {
  /**
   * @param {string} filePath
   * @param {{defaultValue?: any, debounceMs?: number, legacyPaths?: string[], sanitize?: (data:any)=>any}} options
   */
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.defaultValue = typeof options.defaultValue === 'function'
      ? options.defaultValue
      : () => clone(options.defaultValue === undefined ? {} : options.defaultValue);
    this.debounceMs = Number.isFinite(options.debounceMs) ? options.debounceMs : 250;
    this.legacyPaths = Array.isArray(options.legacyPaths) ? options.legacyPaths : [];
    this.sanitize = typeof options.sanitize === 'function' ? options.sanitize : (value) => value;
    this._timer = null;
    this._dirty = false;
    this.data = this._load();
  }

  _read(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  }

  _load() {
    const candidates = [this.filePath, ...this.legacyPaths];
    for (const candidate of candidates) {
      try {
        const parsed = this._read(candidate);
        const clean = this.sanitize(parsed);
        return clean === undefined ? this.defaultValue() : clean;
      } catch (error) {
        if (error && error.code === 'ENOENT') continue;
        if (error instanceof SyntaxError) {
          try {
            const backup = `${candidate}.corrupt-${Date.now()}`;
            fs.renameSync(candidate, backup);
          } catch {
            // If the corrupt file cannot be moved, keep going with defaults.
          }
          continue;
        }
      }
    }
    return this.defaultValue();
  }

  scheduleSave() {
    this._dirty = true;
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this._dirty) this.flush();
    }, this.debounceMs);
    if (this._timer.unref) this._timer.unref();
  }

  flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (!this._dirty) return false;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.tmp-${process.pid}`;
      fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
      try {
        fs.renameSync(temp, this.filePath);
      } catch {
        try {
          fs.rmSync(this.filePath, { force: true });
        } catch {
          // Ignore and retry rename below.
        }
        fs.renameSync(temp, this.filePath);
      }
      this._dirty = false;
      return true;
    } catch (error) {
      console.error('Failed to save store', this.filePath, error.message);
      return false;
    }
  }

  replace(data) {
    this.data = data;
    this.scheduleSave();
  }
}

module.exports = { JsonStore };
