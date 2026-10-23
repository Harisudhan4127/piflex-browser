'use strict';

const crypto = require('crypto');
const { safeStorage } = require('electron');

const CATEGORIES = new Set(['identity', 'address', 'payment']);

/**
 * Autofill profiles for identity and address data, stored as plain rows, and
 * payment methods whose field values are encrypted with safeStorage. Payment
 * data never leaves the main process in plaintext.
 */
class AutofillService {
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

  _sanitizeFields(fields, sensitive) {
    if (!Array.isArray(fields)) return [];
    return fields.slice(0, 40).map((field) => ({
      key: String(field && field.key ? field.key : '').slice(0, 60),
      label: String(field && field.label ? field.label : '').slice(0, 120),
      value: sensitive ? '' : String(field && field.value != null ? field.value : '').slice(0, 1000),
      sensitive: !!sensitive,
    }));
  }

  /** Parse stored fields; payment rows are stored as encrypted JSON. */
  _parseFields(row) {
    let decoded = [];
    try {
      decoded = JSON.parse(row.fields);
    } catch {
      return [];
    }
    if (row.category === 'payment' && decoded.length === 1 && decoded[0] && decoded[0].key === '__encrypted__') {
      if (!this.vaultAvailable) return [];
      try {
        decoded = JSON.parse(safeStorage.decryptString(Buffer.from(decoded[0].value, 'base64')));
      } catch (error) {
        this.logger.warn('Autofill payment decrypt failed', error.message);
        return [];
      }
    }
    return Array.isArray(decoded) ? decoded : [];
  }

  list() {
    if (!this.db.available) return [];
    return this.db
      .prepare('SELECT * FROM autofill ORDER BY updated DESC')
      .all()
      .map((row) => {
        const fields = this._parseFields(row);
        // Mask sensitive values; callers must use reveal() to obtain them.
        const masked = fields.map((f) => ({ ...f, value: f.sensitive ? '' : f.value }));
        return {
          id: row.id,
          name: row.name,
          category: row.category,
          fields: masked.map((f) => ({ ...f, sensitive: row.category === 'payment' || f.sensitive })),
          updated: row.updated,
        };
      });
  }

  reveal(id) {
    if (!this.db.available) return null;
    const row = this.db.prepare('SELECT * FROM autofill WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      fields: this._parseFields(row),
      updated: row.updated,
    };
  }

  save({ id, name, category, fields }) {
    if (!this.db.available) return null;
    const cat = CATEGORIES.has(category) ? category : 'identity';
    const sensitive = cat === 'payment';
    const cleanName = String(name || 'Profile').slice(0, 120);
    let serialized;
    if (sensitive) {
      if (!this.vaultAvailable) throw new Error('Secure storage is unavailable for payment data');
      const payload = JSON.stringify(this._sanitizeFields(fields, false));
      serialized = JSON.stringify([
        { key: '__encrypted__', label: '', value: safeStorage.encryptString(payload).toString('base64'), sensitive: true },
      ]);
    } else {
      serialized = JSON.stringify(this._sanitizeFields(fields, false));
    }
    const now = Date.now();
    if (id) {
      this.db
        .prepare('UPDATE autofill SET name=@name, category=@category, fields=@fields, updated=@now WHERE id=@id')
        .run({ id, name: cleanName, category: cat, fields: serialized, now });
      return { id, name: cleanName, category: cat, updated: now };
    }
    const newId = `a-${now}-${crypto.randomBytes(3).toString('hex')}`;
    this.db
      .prepare('INSERT INTO autofill (id, name, category, fields, updated) VALUES (@id,@name,@category,@fields,@now)')
      .run({ id: newId, name: cleanName, category: cat, fields: serialized, now });
    return { id: newId, name: cleanName, category: cat, updated: now };
  }

  remove(id) {
    if (!this.db.available) return false;
    return this.db.prepare('DELETE FROM autofill WHERE id = ?').run(id).changes > 0;
  }

  clear() {
    if (!this.db.available) return;
    this.db.prepare('DELETE FROM autofill').run();
  }
}

module.exports = { AutofillService, CATEGORIES };
