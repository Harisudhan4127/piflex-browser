'use strict';

const { BrowserWindow } = require('electron');

/**
 * Owns the per-window browser contexts. Each context pairs one BrowserWindow
 * (the trusted React shell) with its own WindowManager (native views) and
 * TabManager (tabs). Keeping these per-window is what makes multi-window and
 * private windows safe: a tab, its view, and its bounds never leak into another
 * window.
 */
class WindowRegistry {
  constructor() {
    /** @type {Map<number, {id:number, private:boolean, window:Electron.BrowserWindow, windowManager:any, tabManager:any}>} */
    this.contexts = new Map();
    this.order = [];
  }

  add(context) {
    this.contexts.set(context.id, context);
    this.order.push(context.id);
  }

  remove(id) {
    this.contexts.delete(id);
    this.order = this.order.filter((value) => value !== id);
  }

  forSender(sender) {
    return sender ? this.contexts.get(sender.id) || null : null;
  }

  forWebContents(id) {
    return this.contexts.get(id) || null;
  }

  /** The focused window, falling back to the most recently created live one. */
  active() {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused && !focused.isDestroyed()) {
      const context = this.contexts.get(focused.webContents.id);
      if (context) return context;
    }
    for (let i = this.order.length - 1; i >= 0; i -= 1) {
      const context = this.contexts.get(this.order[i]);
      if (context && context.window && !context.window.isDestroyed()) return context;
    }
    return null;
  }

  all() {
    return this.order.map((id) => this.contexts.get(id)).filter(Boolean);
  }

  /** Push a global event (download progress, privacy stats, AI stream) to every window. */
  broadcast(channel, payload) {
    for (const context of this.all()) {
      if (context.windowManager) context.windowManager.send(channel, payload);
    }
  }

  setTheme(theme) {
    for (const context of this.all()) context.windowManager.setTheme(theme);
  }

  openExternal(url) {
    const context = this.active();
    return context ? context.windowManager.openExternal(url) : false;
  }

  minimize() {
    const context = this.active();
    if (context && context.windowManager) context.windowManager.minimize();
  }

  toggleMaximize() {
    const context = this.active();
    if (context && context.windowManager) context.windowManager.toggleMaximize();
  }

  close() {
    const context = this.active();
    if (context && context.windowManager) context.windowManager.close();
  }

  isMaximized() {
    const context = this.active();
    return context && context.windowManager ? context.windowManager.isMaximized() : false;
  }

  get window() {
    const context = this.active();
    return context ? context.window : null;
  }

  send(channel, payload) {
    const context = this.active();
    if (context && context.windowManager) context.windowManager.send(channel, payload);
  }

  destroyAll() {
    for (const context of this.all()) {
      try {
        context.tabManager.destroyAll();
      } catch {
        // best effort
      }
    }
    this.contexts.clear();
    this.order = [];
  }
}

module.exports = { WindowRegistry };
