'use strict';

// JSON-file backed persistent stores for bookmarks, history and paged
// settings. Runs exclusively in the main process. Keeps bounded sizes to
// respect low-RAM targets (history trimmed, never grows unbounded).

const fs = require('fs');
const path = require('path');

class JsonStore {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = null;
        try {
            this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        } catch (e) {
            this.data = null;
        }
        if (!this.data || typeof this.data !== 'object') {
            this.data = Array.isArray(this.seed()) ? [] : {};
        }
    }

    seed() { return {}; }

    save() {
        try {
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(this.data));
        } catch (e) {
            console.error('Store save failed:', this.filePath, e.message);
        }
    }
}

class BookmarkStore extends JsonStore {
    // [{ id, title, url, folder, created }]
    seed() { return []; }

    add({ title, url, folder }) {
        this.data = this.data.filter(b => b.url !== url);
        const item = {
            id: 'b-' + Date.now(),
            title: title || url,
            url,
            folder: folder || 'Unsorted',
            created: Date.now(),
        };
        this.data.push(item);
        this.save();
        return item;
    }

    remove(id) {
        const before = this.data.length;
        this.data = this.data.filter(b => b.id !== id);
        if (before !== this.data.length) this.save();
        return before !== this.data.length;
    }

    list() { return this.data; }
}

class HistoryStore extends JsonStore {
    // [{ id, url, title, visited }]
    seed() { return []; }

    constructor(filePath, { maxItems = 5000 } = {}) {
        super(filePath);
        this.maxItems = maxItems;
    }

    add({ url, title }) {
        // Deduplicate consecutive repeated URLs.
        const last = this.data[this.data.length - 1];
        if (last && last.url === url) { last.title = title || last.title; this.save(); return; }
        this.data.push({ id: 'h-' + Date.now() + Math.random().toString(36).slice(2, 5), url, title: title || url, visited: Date.now() });
        if (this.data.length > this.maxItems) {
            this.data = this.data.slice(-this.maxItems);
        }
        this.save();
    }

    search(query = '', limit = 100) {
        const q = String(query).toLowerCase();
        return this.data
            .filter(h => !q || h.url.toLowerCase().includes(q) || (h.title || '').toLowerCase().includes(q))
            .slice(-limit)
            .reverse();
    }

    remove(id) {
        this.data = this.data.filter(h => h.id !== id);
        this.save();
    }

    clearRange(hours) {
        if (hours === null || hours === undefined) { this.data = []; }
        else {
            const since = Date.now() - hours * 3600 * 1000;
            this.data = this.data.filter(h => h.visited < since);
        }
        this.save();
    }
}

module.exports = { JsonStore, BookmarkStore, HistoryStore };
