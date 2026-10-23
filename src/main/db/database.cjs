'use strict';

const path = require('path');
const fs = require('fs');

let Database = null;
let loadError = null;

try {
  // better-sqlite3 is a native module; load lazily so a failed build degrades
  // gracefully instead of crashing the whole app.
  Database = require('better-sqlite3');
} catch (error) {
  loadError = error;
}

const MIGRATIONS = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          host TEXT NOT NULL DEFAULT '',
          visit_count INTEGER NOT NULL DEFAULT 1,
          first_visit INTEGER NOT NULL,
          last_visit INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_history_last ON history(last_visit DESC);
        CREATE INDEX IF NOT EXISTS idx_history_host ON history(host);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_history_url ON history(url);

        CREATE TABLE IF NOT EXISTS downloads (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          url TEXT NOT NULL,
          save_path TEXT,
          mime_type TEXT NOT NULL DEFAULT '',
          total_bytes INTEGER NOT NULL DEFAULT 0,
          received_bytes INTEGER NOT NULL DEFAULT 0,
          state TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          can_resume INTEGER NOT NULL DEFAULT 0,
          danger INTEGER NOT NULL DEFAULT 0,
          error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_downloads_started ON downloads(started_at DESC);

        CREATE TABLE IF NOT EXISTS top_sites (
          host TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          visits INTEGER NOT NULL DEFAULT 0,
          last_visit INTEGER NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0,
          pinned_index INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS credentials (
          id TEXT PRIMARY KEY,
          origin TEXT NOT NULL,
          username TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          secret BLOB NOT NULL,
          created INTEGER NOT NULL,
          updated INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_origin_user ON credentials(origin, username);

        CREATE TABLE IF NOT EXISTS autofill (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          fields TEXT NOT NULL,
          updated INTEGER NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bookmarks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          folder TEXT NOT NULL DEFAULT 'Unsorted',
          position INTEGER NOT NULL DEFAULT 0,
          created INTEGER NOT NULL,
          updated INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
        CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder);
      `);
    },
  },
  {
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions_closed (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          closed_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_closed_at ON sessions_closed(closed_at DESC);
      `);
    },
  },
];

class PiFlexDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.db = null;
    this.available = false;
    this.error = loadError ? String(loadError.message) : null;

    if (!Database) return;

    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      this.db = new Database(filePath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this._migrate();
      this.available = true;
    } catch (error) {
      this.error = String(error.message);
      this.db = null;
    }
  }

  _migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const current = Number(
      this.db.prepare("SELECT value FROM meta WHERE key='schema_version'").pluck().get() || 0,
    );
    for (const migration of MIGRATIONS) {
      if (migration.version <= current) continue;
      const run = this.db.transaction(() => {
        migration.up(this.db);
        this.db
          .prepare(
            "INSERT INTO meta(key, value) VALUES('schema_version', ?) " +
              'ON CONFLICT(key) DO UPDATE SET value=excluded.value',
          )
          .run(String(migration.version));
      });
      run();
    }
  }

  prepare(sql) {
    if (!this.db) throw new Error('Database unavailable: ' + (this.error || 'unknown error'));
    return this.db.prepare(sql);
  }

  transaction(fn) {
    if (!this.db) throw new Error('Database unavailable: ' + (this.error || 'unknown error'));
    return this.db.transaction(fn);
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // best effort
      }
      this.db = null;
    }
  }
}

module.exports = { PiFlexDatabase, SCHEMA_VERSION: MIGRATIONS.length };
