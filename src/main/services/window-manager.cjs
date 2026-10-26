'use strict';

const { BrowserWindow, shell, nativeTheme } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { isSafeExternalUrl } = require('../../../core/url');

const SHELL_BACKGROUND = '#17191D';

/**
 * Hosts the React browser shell (the "chrome") in a single BrowserWindow and
 * manages the WebContentsViews that render web pages. The shell is sandboxed
 * and only talks to the main process through the preload bridge.
 */
class WindowManager {
  constructor({ preloadPath, devServerUrl, logger, shellFile }) {
    this.preloadPath = preloadPath;
    this.devServerUrl = devServerUrl || null;
    this.shellFile = shellFile;
    this.logger = logger || { warn() {} };
    this.window = null;
    this.attachedView = null;
    this.views = new Set();
    this.onExternal = null;
    this.isPrivate = false;
  }

  rendererUrl() {
    if (this.devServerUrl) return this.devServerUrl;
    // Loaded from disk in production; internal pages append a route query.
    return pathToFileURL(this.shellFile).href;
  }

  create({ title = 'PiFlex', private: isPrivate = false } = {}) {
    this.isPrivate = !!isPrivate;
    this.window = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 720,
      minHeight: 480,
      show: false,
      title,
      backgroundColor: SHELL_BACKGROUND,
      autoHideMenuBar: true,
      // Windows/Linux use a frameless window so the browser's own title-bar
      // controls are the only ones shown. macOS keeps its inset traffic lights.
      frame: process.platform === 'darwin',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      thickFrame: true,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // preload must require('electron') but exposes a strict allow-list
        webSecurity: true,
        partition: this.isPrivate ? 'piflex-private' : 'persist:piflex',
      },
    });

    this.window.once('ready-to-show', () => {
      if (this.window && !this.window.isDestroyed()) this.window.show();
    });
    this.window.on('maximize', () => this._sendMaximized(true));
    this.window.on('unmaximize', () => this._sendMaximized(false));
    this.window.on('closed', () => {
      this.window = null;
      this.attachedView = null;
      this.views.clear();
      this.isPrivate = false;
    });

    this.window.webContents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url) && this.onExternal) this.onExternal(url);
      else if (isSafeExternalUrl(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    this.window.webContents.on('will-navigate', (event, url) => {
      // The shell itself must never navigate away from the app.
      const allowed = url.startsWith('file://') || (this.devServerUrl && url.startsWith(this.devServerUrl));
      if (!allowed) event.preventDefault();
    });

    const url = this.devServerUrl || this.rendererUrl();
    this.window.loadURL(url).catch((error) => this.logger.warn('Shell load failed', error.message));
    return this.window;
  }

  send(channel, payload) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, payload);
    }
  }

  _sendMaximized(isMaximized) {
    this.send('window:maximized', isMaximized);
  }

  isMaximized() {
    return !!(this.window && this.window.isMaximized());
  }

  minimize() {
    if (this.window) this.window.minimize();
  }

  toggleMaximize() {
    if (!this.window) return;
    if (this.window.isMaximized()) this.window.unmaximize();
    else this.window.maximize();
  }

  close() {
    if (this.window) this.window.close();
  }

  get contentView() {
    return this.window ? this.window.contentView : null;
  }

  attachView(view) {
    const container = this.contentView;
    if (!container) return;
    if (this.attachedView && this.attachedView !== view) {
      try {
        container.removeChildView(this.attachedView);
      } catch {
        // already detached
      }
    }
    // `views` tracks every view this window owns, not which one is currently a
    // child of the content view. Always re-add when the view is not the one
    // currently attached, otherwise switching A -> B -> A leaves the container
    // empty because A is still in `views`.
    if (this.attachedView !== view) {
      try {
        container.addChildView(view);
      } catch {
        // already attached (defensive)
      }
    }
    this.views.add(view);
    this.attachedView = view;
  }

  detachView(view) {
    const container = this.contentView;
    if (container && this.views.has(view)) {
      try {
        container.removeChildView(view);
      } catch {
        // ignore
      }
      this.views.delete(view);
    }
    if (this.attachedView === view) this.attachedView = null;
  }

  /** Detach whatever native view is currently visible (used when an internal page becomes active). */
  detachAttachedView() {
    if (this.attachedView) this.detachView(this.attachedView);
  }

  clearViews() {
    const container = this.contentView;
    if (container) {
      for (const view of this.views) {
        try {
          container.removeChildView(view);
        } catch {
          // ignore
        }
      }
    }
    this.views.clear();
    this.attachedView = null;
  }

  setViewBounds(view, bounds) {
    if (!view) return;
    const { x = 0, y = 0, width = 0, height = 0 } = bounds || {};
    view.setBounds({
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
      width: Math.max(0, Math.round(width)),
      height: Math.max(0, Math.round(height)),
    });
  }

  setTheme(theme) {
    if (theme === 'system') nativeTheme.themeSource = 'system';
    else if (theme === 'dark' || theme === 'light') nativeTheme.themeSource = theme;
  }

  openExternal(url) {
    if (!isSafeExternalUrl(url)) return false;
    try {
      shell.openExternal(url);
      return true;
    } catch (error) {
      this.logger.warn('Could not open external URL', error.message);
      return false;
    }
  }

  static preloadPathFor(appRoot) {
    return path.join(appRoot, 'src', 'preload', 'index.cjs');
  }
}

module.exports = { WindowManager, SHELL_BACKGROUND };
