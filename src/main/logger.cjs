'use strict';

const fs = require('fs');
const path = require('path');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
  constructor(filePath, level = 'warn') {
    this.filePath = filePath || null;
    this.level = LEVELS[level] === undefined ? LEVELS.warn : LEVELS[level];
    this.ring = [];
    if (this.filePath) {
      try {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      } catch {
        this.filePath = null;
      }
    }
  }

  setLevel(level) {
    this.level = LEVELS[level] === undefined ? LEVELS.warn : LEVELS[level];
  }

  _write(level, args) {
    const numeric = LEVELS[level] === undefined ? LEVELS.info : LEVELS[level];
    if (numeric > this.level) return;
    const text = args
      .map((value) => {
        if (value instanceof Error) return value.stack || value.message;
        if (typeof value === 'object') {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        }
        return String(value);
      })
      .join(' ');
    const line = `${new Date().toISOString()} [${level}] ${text}`;
    this.ring.push(line);
    if (this.ring.length > 300) this.ring.shift();
    if (level === 'error') console.error(text);
    else if (level === 'warn') console.warn(text);
    else if (process.env.PIFLEX_DEBUG) console.log(text);
    if (this.filePath) {
      try {
        fs.appendFileSync(this.filePath, line + '\n');
      } catch {
        // Logging must never crash browsing.
      }
    }
  }

  error(...args) { this._write('error', args); }
  warn(...args) { this._write('warn', args); }
  info(...args) { this._write('info', args); }
  debug(...args) { this._write('debug', args); }
  recent() { return this.ring.slice(-100); }
}

module.exports = { Logger };
