'use strict';

const crypto = require('crypto');
const { safeStorage } = require('electron');
const { originOf } = require('../../../core/url');

/**
 * Credential vault.
 *
 * Passwords are encrypted with Electron's safeStorage, which is backed by the
 * OS keychain (DPAPI on Windows, Keychain on macOS, libsecret on Linux). The
 * ciphertext is the only thing persisted in SQLite; plaintext never leaves this
 * module except through an explicit `reveal` call gated by the renderer's
 * re-authentication flow.
 */
class CredentialService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger || { warn() {} };
  }

  get vaultAvailable() {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  _encrypt(plaintext) {
    if (!this.vaultAvailable) {
      throw new Error('Secure storage is unavailable on this system');
    }
    return safeStorage.encryptString(String(plaintext));
  }

  _decrypt(buffer) {
    if (!this.vaultAvailable) {
      throw new Error('Secure storage is unavailable on this system');
    }
    return safeStorage.decryptString(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  }

  list() {
    if (!this.db.available) return [];
    return this.db
      .prepare('SELECT id, origin, username, title, created, updated FROM credentials ORDER BY updated DESC')
      .all()
      .map((row) => ({
        id: row.id,
        origin: row.origin,
        username: row.username,
        title: row.title || row.origin,
        created: row.created,
        updated: row.updated,
      }));
  }

  /** Full record including decrypted password. Callers must enforce re-auth. */
  reveal(id) {
    if (!this.db.available) return null;
    const row = this.db.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
    if (!row) return null;
    let password = '';
    try {
      password = this._decrypt(row.secret);
    } catch (error) {
      this.logger.warn('Credential decryption failed', error.message);
      return null;
    }
    return {
      id: row.id,
      origin: row.origin,
      username: row.username,
      title: row.title || row.origin,
      password,
      created: row.created,
      updated: row.updated,
    };
  }

  /** Used by autofill: return the matching credential without exposing it to UI. */
  match(origin) {
    if (!this.db.available) return null;
    const clean = originOf(origin);
    if (!clean) return null;
    const row = this.db
      .prepare('SELECT * FROM credentials WHERE origin = ? ORDER BY updated DESC LIMIT 1')
      .get(clean);
    if (!row) return null;
    try {
      return { id: row.id, origin: row.origin, username: row.username, password: this._decrypt(row.secret) };
    } catch {
      return null;
    }
  }

  save({ origin, username, password, title }) {
    if (!this.db.available) return null;
    const cleanOrigin = originOf(origin);
    if (!cleanOrigin) throw new Error('A valid website origin is required');
    const cleanUser = String(username || '').slice(0, 300);
    const secret = this._encrypt(password);
    const now = Date.now();
    const existing = this.db
      .prepare('SELECT id FROM credentials WHERE origin = ? AND username = ?')
      .get(cleanOrigin, cleanUser);
    if (existing) {
      this.db
        .prepare('UPDATE credentials SET secret=@secret, title=@title, updated=@now WHERE id=@id')
        .run({ id: existing.id, secret, title: String(title || cleanOrigin).slice(0, 300), now });
      return { id: existing.id, origin: cleanOrigin, username: cleanUser, title: title || cleanOrigin };
    }
    const id = `c-${now}-${crypto.randomBytes(3).toString('hex')}`;
    this.db
      .prepare(
        `INSERT INTO credentials (id, origin, username, title, secret, created, updated)
         VALUES (@id, @origin, @username, @title, @secret, @now, @now)`,
      )
      .run({
        id,
        origin: cleanOrigin,
        username: cleanUser,
        title: String(title || cleanOrigin).slice(0, 300),
        secret,
        now,
      });
    return { id, origin: cleanOrigin, username: cleanUser, title: title || cleanOrigin };
  }

  update(id, patch = {}) {
    if (!this.db.available) return null;
    const row = this.db.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
    if (!row) return null;
    const username = patch.username !== undefined ? String(patch.username).slice(0, 300) : row.username;
    const title = patch.title !== undefined ? String(patch.title).slice(0, 300) : row.title;
    const secret = patch.password !== undefined && patch.password !== '' ? this._encrypt(patch.password) : row.secret;
    this.db
      .prepare('UPDATE credentials SET username=@username, title=@title, secret=@secret, updated=@now WHERE id=@id')
      .run({ id, username, title, secret, now: Date.now() });
    return { id, origin: row.origin, username, title };
  }

  remove(id) {
    if (!this.db.available) return false;
    return this.db.prepare('DELETE FROM credentials WHERE id = ?').run(id).changes > 0;
  }

  clear() {
    if (!this.db.available) return;
    this.db.prepare('DELETE FROM credentials').run();
  }

  /** Cryptographically strong password generator for the password manager UI. */
  generate({
    length = 20,
    upper = true,
    lower = true,
    digits = true,
    symbols = true,
  } = {}) {
    const sets = [];
    if (lower) sets.push('abcdefghijkmnpqrstuvwxyz');
    if (upper) sets.push('ABCDEFGHJKLMNPQRSTUVWXYZ');
    if (digits) sets.push('23456789');
    if (symbols) sets.push('!@#$%^&*()-_=+[]{};:,.?');
    if (!sets.length) sets.push('abcdefghijkmnpqrstuvwxyz23456789');
    const len = Math.max(8, Math.min(128, Number(length) || 20));
    const all = sets.join('');
    const pick = (pool) => pool[crypto.randomInt(0, pool.length)];
    const chars = sets.map((pool) => pick(pool));
    while (chars.length < len) chars.push(pick(all));
    // Fisher-Yates shuffle using crypto randomness.
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = crypto.randomInt(0, i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  /** Non-blocking strength estimate (0-4) for UI hints. No zxcvbn dependency. */
  static strength(password) {
    const text = String(password || '');
    if (!text) return 0;
    let score = 0;
    if (text.length >= 8) score += 1;
    if (text.length >= 12) score += 1;
    if (/[a-z]/.test(text) && /[A-Z]/.test(text)) score += 1;
    if (/\d/.test(text) && /[^A-Za-z0-9]/.test(text)) score += 1;
    const unique = new Set(text).size;
    if (unique < text.length / 2) score = Math.max(0, score - 1);
    return Math.min(4, score);
  }
}

module.exports = { CredentialService };
