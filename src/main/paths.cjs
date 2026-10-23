'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let cached = null;

/**
 * Resolved, per-user data locations. The main process owns these paths; they
 * are never exposed to web content.
 */
function getPaths() {
  if (cached) return cached;
  const userData = app.getPath('userData');
  const data = path.join(userData, 'data');
  cached = {
    userData,
    data,
    db: path.join(data, 'piflex.sqlite'),
    filters: path.join(data, 'filters'),
    models: path.join(data, 'models'),
    runtime: path.join(data, 'runtime'),
    extensions: path.join(data, 'extensions'),
    vault: path.join(data, 'vault.bin'),
    logs: path.join(data, 'logs'),
    settings: path.join(data, 'settings.json'),
    sessions: path.join(data, 'sessions.json'),
  };
  return cached;
}

function ensureDirectories() {
  const paths = getPaths();
  for (const dir of [
    paths.data,
    paths.filters,
    paths.models,
    paths.runtime,
    paths.extensions,
    paths.logs,
  ]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      console.error('Could not create directory', dir, error.message);
    }
  }
  return paths;
}

function downloadDirectory(settings) {
  const configured = settings && settings.downloads && settings.downloads.directory;
  if (configured) {
    try {
      fs.mkdirSync(configured, { recursive: true });
      return configured;
    } catch {
      // Fall through to the OS default when a custom path is unusable.
    }
  }
  try {
    return app.getPath('downloads');
  } catch {
    return app.getPath('home');
  }
}

function isInside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

module.exports = { downloadDirectory, ensureDirectories, getPaths, isInside };
