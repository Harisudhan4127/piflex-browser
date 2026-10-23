'use strict';

const path = require('path');

const RISKY_EXTENSIONS = new Set([
  '.exe',
  '.msi',
  '.msix',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.ps1',
  '.psm1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.jar',
  '.apk',
  '.appimage',
  '.deb',
  '.rpm',
  '.dmg',
  '.pkg',
  '.sh',
  '.bash',
  '.run',
  '.bin',
  '.iso',
  '.hta',
  '.lnk',
  '.reg',
]);

const VALID_STATES = new Set(['active', 'paused', 'completed', 'cancelled', 'failed', 'interrupted']);

const FALLBACK_NAME = 'download';

function sanitizeFilename(name) {
  let value = String(name == null ? '' : name)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\\/g, '/')
    .trim();
  value = path.posix.basename(value);
  value = value.replace(/[<>:"|?*]/g, '_');
  value = value.replace(/^\.+/, '');
  if (!value || value === '.' || value === '..') value = FALLBACK_NAME;
  if (value.length > 180) {
    const ext = path.extname(value).slice(0, 20);
    value = value.slice(0, 180 - ext.length) + ext;
  }
  return value;
}

function isRiskyFilename(name) {
  return RISKY_EXTENSIONS.has(path.extname(String(name || '')).toLowerCase());
}

/**
 * Build a unique destination inside a directory without touching the disk.
 * @param {string} dir
 * @param {string} filename
 * @param {(candidate:string)=>boolean} exists
 */
function uniqueDestination(dir, filename, exists) {
  const safe = sanitizeFilename(filename);
  const ext = path.extname(safe);
  const base = path.basename(safe, ext);
  const check = typeof exists === 'function' ? exists : () => false;
  let candidate = path.join(dir, safe);
  let index = 1;
  while (check(candidate)) {
    candidate = path.join(dir, `${base} (${index++})${ext}`);
    if (index > 10000) throw new Error('Could not allocate a unique download filename');
  }
  return candidate;
}

function isValidState(state) {
  return VALID_STATES.has(String(state));
}

function canPause(state) {
  return state === 'active';
}

function canResume(state) {
  return state === 'paused' || state === 'failed' || state === 'interrupted';
}

function canCancel(state) {
  return state === 'active' || state === 'paused';
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

module.exports = {
  RISKY_EXTENSIONS,
  canCancel,
  canPause,
  canResume,
  formatBytes,
  isRiskyFilename,
  isValidState,
  sanitizeFilename,
  uniqueDestination,
};
