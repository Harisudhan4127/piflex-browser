'use strict';

// Download manager: tracks active, completed, failed and cancelled
// downloads, supports pause/resume/cancel (Electron DownloadItem supports
// all three), peers only safe filenames, and broadcasts progress to the
// renderer without opening anything automatically.

const path = require('path');
const fs = require('fs');

// Extensions treated as potentially dangerous (warned and never auto-opened).
const RISKY_EXTS = new Set(['.exe', '.bat', '.cmd', '.scr', '.msi', '.ps1', '.jar', '.apk', '.sh', '.vbs']);

class DownloadManager {
    constructor(downloadsDir, broadcast) {
        this.downloadsDir = downloadsDir;
        this.broadcast = broadcast; // fn(payload) -> renderer push
        this.items = new Map(); // id -> view item
        this._native = new Map(); // id -> Electron DownloadItem
        this._nextId = 1;
    }

    attach(session) {
        this._cleanupDir();
        session.on('will-download', (event, item) => {
            const id = this._nextId++;
            const safeName = this._safeFilename(item.getFilename());
            const dest = this._uniqueDestination(safeName);
            item.setSavePath(dest);

            const view = {
                id,
                filename: path.basename(dest),
                path: dest,
                url: item.getURL(),
                mime: item.getMimeType(),
                total: item.getTotalBytes(),
                received: 0,
                state: 'active', // active | paused | completed | cancelled | failed
                paused: false,
                risky: RISKY_EXTS.has(path.extname(safeName).toLowerCase()),
            };
            this.items.set(id, view);
            this._native.set(id, item);
            this._push(view);

            item.on('updated', (_e, state) => {
                view.received = item.getReceivedBytes();
                view.total = item.getTotalBytes();
                if (state === 'interrupted') view.state = 'failed';
                else if (state === 'progressing') {
                    view.paused = !item.canResume() && view.paused ? true : view.paused;
                    if (item.isPaused()) view.paused = true;
                }
                this._push(view);
            });
            item.once('done', (_e, state) => {
                if (state === 'completed') view.state = 'completed';
                else if (state === 'cancelled') {
                    view.state = 'cancelled';
                    try { fs.unlinkSync(dest); } catch (e) {}
                } else view.state = 'failed';
                this._push(view);
            });
        });
    }

    list() {
        return [...this.items.values()].sort((a, b) => b.id - a.id).slice(0, 50);
    }

    pause(id) { const it = this._find(id); if (it && it.state === 'active') { const item = this._nativeItem(id); if (item) { item.pause(); it.paused = true; it.state = 'paused'; this._push(it); } } }

    resume(id) { const it = this._find(id); if (it && ['paused', 'failed'].includes(it.state)) { const item = this._nativeItem(id); if (item) { item.resume(); it.paused = false; it.state = 'active'; this._push(it); } } }

    cancel(id) {
        const it = this._find(id);
        if (it && (it.state === 'active' || it.state === 'paused')) {
            const item = this._nativeItem(id);
            if (item) item.cancel();
            it.state = 'cancelled';
            this._push(it);
        }
    }

    _nativeItem(id) { return this._native.get(id); }

    _find(id) { return this.items.get(id); }

    _push(view) {
        if (!this.broadcast) return;
        this.broadcast({ channel: 'downloads', data: view });
    }

    _safeFilename(name) {
        let n = String(name || 'download').replace(/[\r\n]+/g, ' ').trim();
        // strip path traversal and reserved chars
        n = path.basename(n).replace(/[<>:"|?*\x00-\x1f]/g, '_');
        if (!n || n === '.' || n === '..') n = 'download';
        return n.slice(0, 180);
    }

    _uniqueDestination(name) {
        const ext = path.extname(name);
        const base = path.basename(name, ext);
        let candidate = path.join(this.downloadsDir, name);
        let i = 1;
        while (fs.existsSync(candidate)) {
            candidate = path.join(this.downloadsDir, `${base} (${i++})${ext}`);
        }
        fs.mkdirSync(this.downloadsDir, { recursive: true });
        return candidate;
    }

    _cleanupDir() {
        try { fs.mkdirSync(this.downloadsDir, { recursive: true }); } catch (e) {}
    }
}

module.exports = { DownloadManager, RISKY_EXTS };
