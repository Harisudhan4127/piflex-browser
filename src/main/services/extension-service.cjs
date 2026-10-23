'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Extension manager built on Electron's supported extension API
 * (session.loadExtension for unpacked Chromium extensions).
 *
 * Honest scope: this is Electron's extension subset, NOT full Chrome Web Store
 * parity. Store installation is not supported; users load unpacked extensions
 * from a directory. When the engine rejects an extension we report the real
 * error rather than pretending it loaded.
 */
class ExtensionService {
  constructor({ session, extensionsDir, logger }) {
    this.session = session;
    this.extensionsDir = extensionsDir;
    this.logger = logger || { warn() {} };
    this.loaded = new Map(); // id -> { record, electronExtension }
  }

  isSupported() {
    return typeof this.session.loadExtension === 'function';
  }

  ensureDir() {
    try {
      fs.mkdirSync(this.extensionsDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  async loadAll() {
    this.ensureDir();
    const entries = [];
    try {
      for (const name of fs.readdirSync(this.extensionsDir)) {
        const full = path.join(this.extensionsDir, name);
        if (fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'manifest.json'))) {
          entries.push(full);
        }
      }
    } catch (error) {
      this.logger.warn('Extension scan failed', error.message);
    }
    for (const dir of entries) {
      await this.load(dir).catch((error) => this.logger.warn('Extension load failed', dir, error.message));
    }
  }

  _readManifest(dir) {
    const file = path.join(dir, 'manifest.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      name: String(raw.name || path.basename(dir)).slice(0, 120),
      version: String(raw.version || '0.0.0').slice(0, 32),
      description: String(raw.description || '').slice(0, 400),
      manifestVersion: Number(raw.manifest_version) || 2,
      permissions: Array.isArray(raw.permissions) ? raw.permissions.slice(0, 60).map(String) : [],
      hostPermissions: Array.isArray(raw.host_permissions)
        ? raw.host_permissions.slice(0, 60).map(String)
        : Array.isArray(raw.permissions)
          ? raw.permissions.filter((p) => String(p).includes('://')).slice(0, 60)
          : [],
    };
  }

  async load(dir) {
    this.ensureDir();
    if (!this.isSupported()) throw new Error('Extension runtime is unavailable in this Electron build');
    const manifest = this._readManifest(dir);
    const extension = await this.session.loadExtension(dir, { allowFileAccess: false });
    const id = extension.id;
    this.loaded.set(id, {
      id,
      name: extension.name || manifest.name,
      version: extension.version || manifest.version,
      description: manifest.description,
      enabled: true,
      path: dir,
      permissions: manifest.permissions,
      hostPermissions: manifest.hostPermissions,
      toolbarVisible: true,
      error: null,
    });
    return this.loaded.get(id);
  }

  async installFromDirectory(dir) {
    const target = path.join(this.extensionsDir, path.basename(dir));
    fs.cpSync(dir, target, { recursive: true });
    return this.load(target);
  }

  list() {
    return [...this.loaded.values()].map((record) => ({ ...record }));
  }

  async setEnabled(id, enabled) {
    const record = this.loaded.get(id);
    if (!record) return null;
    if (!enabled) {
      try {
        this.session.removeExtension(id);
      } catch (error) {
        this.logger.warn('Extension disable failed', error.message);
      }
      record.enabled = false;
      return { ...record };
    }
    try {
      await this.load(record.path);
      record.enabled = true;
      return { ...record };
    } catch (error) {
      record.error = error.message;
      return { ...record };
    }
  }

  setToolbarVisible(id, visible) {
    const record = this.loaded.get(id);
    if (!record) return null;
    record.toolbarVisible = !!visible;
    return { ...record };
  }

  async remove(id) {
    const record = this.loaded.get(id);
    if (!record) return false;
    try {
      this.session.removeExtension(id);
    } catch {
      // ignore
    }
    this.loaded.delete(id);
    try {
      fs.rmSync(record.path, { recursive: true, force: true });
    } catch {
      // best effort
    }
    return true;
  }
}

module.exports = { ExtensionService };
