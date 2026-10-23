'use strict';

const fs = require('fs');
const path = require('path');
const { sanitizeFilename, uniqueDestination, isRiskyFilename } = require('../../../core/downloads');

function rowToItem(row) {
  return {
    id: row.id,
    filename: row.filename,
    url: row.url,
    savePath: row.save_path,
    mimeType: row.mime_type,
    totalBytes: row.total_bytes,
    receivedBytes: row.received_bytes,
    state: row.state,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    canResume: !!row.can_resume,
    danger: !!row.danger,
    error: row.error || null,
  };
}

/**
 * Download manager. Tracks items in SQLite and exposes open/show/retry actions.
 * Files are never executed automatically; risky types are flagged for the user.
 */
class DownloadService {
  constructor({ db, settingsService, downloadDirectory, logger, onUpdate, shell }) {
    this.db = db;
    this.settings = settingsService;
    this.downloadDirectory = downloadDirectory;
    this.logger = logger || { warn() {} };
    this.onUpdate = onUpdate || (() => {});
    this.shell = shell;
    this.items = new Map();
    this.session = null;
  }

  attach(session) {
    this.session = session;
    session.on('will-download', (event, item) => this._onWillDownload(item));
  }

  _onWillDownload(item) {
    const dir = this.downloadDirectory(this.settings.get());
    let savePath;
    try {
      savePath = uniqueDestination(dir, item.getFilename(), (candidate) => fs.existsSync(candidate));
    } catch (error) {
      this.logger.warn('Download destination failed', error.message);
      item.cancel();
      return;
    }
    item.setSavePath(savePath);

    const id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = sanitizeFilename(item.getFilename());
    const record = {
      id,
      filename,
      url: item.getURL(),
      savePath,
      mimeType: item.getMimeType() || '',
      totalBytes: item.getTotalBytes() || 0,
      receivedBytes: 0,
      state: 'progressing',
      startedAt: Date.now(),
      completedAt: null,
      canResume: item.canResume(),
      danger: isRiskyFilename(filename),
      error: null,
    };
    this._persist(record);
    this.items.set(id, { item, record });
    this._emit(record);

    item.on('updated', (_e, state) => {
      record.receivedBytes = item.getReceivedBytes();
      record.totalBytes = item.getTotalBytes() || record.totalBytes;
      record.state = state === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing';
      record.canResume = item.canResume();
      this._persist(record);
      this._emit(record);
    });
    item.once('done', (_e, state) => {
      record.receivedBytes = item.getReceivedBytes();
      record.completedAt = Date.now();
      record.canResume = item.canResume();
      if (state === 'completed') record.state = 'completed';
      else if (state === 'cancelled') {
        record.state = 'cancelled';
        record.error = 'Cancelled';
      } else {
        record.state = 'interrupted';
        record.error = 'Download failed';
      }
      this._persist(record);
      this._emit(record);
      this.items.delete(id);
    });
  }

  _persist(record) {
    if (!this.db.available) return;
    try {
      this.db
        .prepare(
          `INSERT INTO downloads (id, filename, url, save_path, mime_type, total_bytes, received_bytes,
             state, started_at, completed_at, can_resume, danger, error)
           VALUES (@id,@filename,@url,@save_path,@mime_type,@total_bytes,@received_bytes,
             @state,@started_at,@completed_at,@can_resume,@danger,@error)
           ON CONFLICT(id) DO UPDATE SET
             received_bytes=excluded.received_bytes, total_bytes=excluded.total_bytes,
             state=excluded.state, completed_at=excluded.completed_at,
             can_resume=excluded.can_resume, error=excluded.error`,
        )
        .run({
          id: record.id,
          filename: record.filename,
          url: record.url,
          save_path: record.savePath,
          mime_type: record.mimeType,
          total_bytes: record.totalBytes,
          received_bytes: record.receivedBytes,
          state: record.state,
          started_at: record.startedAt,
          completed_at: record.completedAt,
          can_resume: record.canResume ? 1 : 0,
          danger: record.danger ? 1 : 0,
          error: record.error,
        });
    } catch (error) {
      this.logger.warn('Download persist failed', error.message);
    }
  }

  _emit(record) {
    this.onUpdate({ ...record });
  }

  list() {
    if (!this.db.available) return [];
    return this.db
      .prepare('SELECT * FROM downloads ORDER BY started_at DESC LIMIT 200')
      .all()
      .map(rowToItem);
  }

  get(id) {
    if (!this.db.available) return null;
    const row = this.db.prepare('SELECT * FROM downloads WHERE id = ?').get(id);
    return row ? rowToItem(row) : null;
  }

  pause(id) {
    const entry = this.items.get(id);
    if (entry) {
      entry.item.pause();
      return true;
    }
    return false;
  }

  resume(id) {
    const entry = this.items.get(id);
    if (entry) {
      entry.item.resume();
      return true;
    }
    return false;
  }

  cancel(id) {
    const entry = this.items.get(id);
    if (entry) {
      entry.item.cancel();
      return true;
    }
    return false;
  }

  remove(id) {
    this.items.delete(id);
    if (!this.db.available) return false;
    return this.db.prepare('DELETE FROM downloads WHERE id = ?').run(id).changes > 0;
  }

  clear() {
    if (!this.db.available) return;
    this.db.prepare("DELETE FROM downloads WHERE state != 'progressing'").run();
  }

  open(id) {
    const record = this.get(id);
    if (!record || !record.savePath || record.state !== 'completed') return { ok: false, error: 'File is not available' };
    try {
      this.shell.openPath(record.savePath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  showInFolder(id) {
    const record = this.get(id);
    if (!record || !record.savePath) return { ok: false, error: 'File is not available' };
    try {
      this.shell.showItemInFolder(record.savePath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  retry(id) {
    const record = this.get(id);
    if (!record) return { ok: false, error: 'Download not found' };
    if (!this.session) return { ok: false, error: 'Download session unavailable' };
    try {
      this.session.downloadURL(record.url);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
}

module.exports = { DownloadService, rowToItem };
