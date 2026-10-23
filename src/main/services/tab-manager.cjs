'use strict';

const { WebContentsView, session, shell } = require('electron');
const crypto = require('crypto');
const { IPC } = require('../../shared/ipc.cjs');
const {
  classifyInput,
  displayHost,
  hostnameOf,
  originOf,
  securityState,
  isSafeExternalUrl,
} = require('../../../core/url');

const DEFAULT_URL = 'piflex://newtab';

// Runs inside the page to read visible text. Kept small and read-only: it never
// mutates the DOM, never touches form fields, and never returns credentials.
const PAGE_TEXT_SCRIPT = `(() => {
  try {
    const el = document.body || document.documentElement;
    if (!el) return '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const parts = [];
    let total = 0;
    const LIMIT = 60000;
    let node = walker.nextNode();
    while (node && total < LIMIT) {
      const value = node.nodeValue.replace(/\\s+/g, ' ').trim();
      if (value) { parts.push(value); total += value.length + 1; }
      node = walker.nextNode();
    }
    return parts.join('\\n').slice(0, LIMIT);
  } catch (e) {
    return '';
  }
})()`;


// Runs inside YouTube tabs only when network ad blocking is enabled. YouTube
// serves ads from first-party origins, so this removes in-feed/display ad
// slots and advances the player past pre-roll/mid-roll ads. It never touches
// other sites and performs no network activity of its own.
const YOUTUBE_AD_SCRIPT = `(() => {
  if (window.__piflexYtAds) { window.__piflexYtAds(); return; }
  const selectors = [
    '#player-ads', '#masthead-ad', '#offer-module',
    '.ytp-ad-overlay-container', '.ytp-ad-overlay-slot',
    'ytd-display-ad-renderer', 'ytd-promoted-sparkles-web-renderer',
    'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer',
    'ytd-banner-promo-renderer', 'ytd-statement-banner-renderer',
  ];
  const click = (selector) => {
    const node = document.querySelector(selector);
    if (node && typeof node.click === 'function') node.click();
  };
  const removeAds = () => {
    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) node.remove();
    }
  };
  const skip = () => {
    const player = document.querySelector('.html5-video-player');
    if (!player || !player.classList.contains('ad-showing')) return;
    click('.ytp-ad-skip-button-modern');
    click('.ytp-ad-skip-button');
    click('.ytp-skip-ad-button');
    click('.ytp-ad-overlay-close-button');
    const video = player.querySelector('video');
    if (video && isFinite(video.duration) && video.duration > 0) {
      try {
        if (video.currentTime < video.duration - 0.2) video.currentTime = video.duration;
      } catch (e) {}
    }
  };
  let queued = false;
  const run = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      try { skip(); removeAds(); } catch (e) {}
    });
  };
  window.__piflexYtAds = run;
  run();
  if (window.__piflexYtObserver) window.__piflexYtObserver.disconnect();
  window.__piflexYtObserver = new MutationObserver(run);
  window.__piflexYtObserver.observe(document.documentElement, { childList: true, subtree: true });
  if (window.__piflexYtTimer) clearInterval(window.__piflexYtTimer);
  window.__piflexYtTimer = setInterval(run, 1000);
})()`;

function makeId() {
  return `t-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * Browser-level shortcuts must work even while a page has keyboard focus. The
 * shell only receives key events when it is focused, so tab web contents
 * forward the whitelisted combinations to the shell. Everything else (typing,
 * copy/paste, page shortcuts) is left untouched.
 */
function isBrowserShortcut(input) {
  const key = String(input.key || '').toLowerCase();
  const ctrl = !!(input.control || input.meta);
  if (ctrl && !input.shift && ['t', 'w', 'l', 'f', 'r', 'h', 'j', 'n'].includes(key)) return true;
  if (ctrl && input.shift && ['n', 'o', 'b'].includes(key)) return true;
  if (ctrl && key === ',') return true;
  if (ctrl && key === 'tab') return true;
  if (input.alt && ['arrowleft', 'arrowright', 'd'].includes(key)) return true;
  if (input.key === 'F5') return true;
  return false;
}

/**
 * Electron 45 moved history navigation behind `navigationHistory`. Fall back to
 * the legacy methods so the browser keeps working on older runtimes.
 */
function canNavigate(webContents, direction) {
  const history = webContents.navigationHistory;
  if (history && typeof history[direction === 'back' ? 'canGoBack' : 'canGoForward'] === 'function') {
    return direction === 'back' ? history.canGoBack() : history.canGoForward();
  }
  return direction === 'back' ? webContents.canGoBack() : webContents.canGoForward();
}

/**
 * Owns a WebContentsView per tab and translates engine events into the
 * serialisable TabState the React shell renders. Web content is never given
 * access to Node or the privileged IPC surface.
 */
class TabManager {
  constructor({
    windowManager,
    settingsService,
    historyService,
    logger,
    onStateChange,
    onTabEvent,
    onPermission,
    onDownload,
    defaultSearchEngine,
    shellSession,
  }) {
    this.windowManager = windowManager;
    this.settings = settingsService;
    this.history = historyService;
    this.logger = logger || { warn() {} };
    this.onStateChange = onStateChange || (() => {});
    this.onTabEvent = onTabEvent || (() => {});
    this.onPermission = onPermission || (() => {});
    this.onDownload = onDownload || (() => {});
    this.defaultSearchEngine = defaultSearchEngine;
    this.shellSession = shellSession;

    this.tabs = new Map();
    this.order = [];
    this.activeTabId = null;
    this.viewBounds = { x: 0, y: 0, width: 0, height: 0 };
    this.groupSeq = 0;
    this.viewVisible = true;
  }

  getPartition(isPrivate) {
    return isPrivate ? 'piflex-private' : 'persist:piflex';
  }

  _resolveInput(input) {
    const classified = classifyInput(input);
    if (classified.kind === 'url') return { url: classified.url };
    if (classified.kind === 'empty') return { url: DEFAULT_URL };
    if (classified.kind === 'blocked') return { error: classified.reason || 'Blocked input' };
    const engine = this.defaultSearchEngine();
    return { url: engine ? engine.template.replace('{query}', encodeURIComponent(classified.value)) : null };
  }

  create({ url, private: isPrivate = false, active = true, background = false, groupId = null, pinned = false } = {}) {
    const id = makeId();
    const partition = isPrivate ? 'piflex-private' : 'persist:piflex';
    const ses = session.fromPartition(partition);

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: true,
        partition,
      },
    });
    view.setBackgroundColor('#17191D');

    const tab = {
      id,
      view,
      url: url || DEFAULT_URL,
      title: '',
      favicon: null,
      loading: false,
      private: isPrivate,
      pinned,
      groupId,
      muted: false,
      crashed: false,
      internal: String(url || DEFAULT_URL).startsWith('piflex://'),
      security: securityState(url || DEFAULT_URL),
    };
    this.tabs.set(id, tab);
    this.order.push(id);
    this._wire(tab);
    this._load(tab, url || DEFAULT_URL);

    if (active) this.activate(id);
    this._emitCreated(tab);
    if (!background) this._broadcast();
    return this.serialize(id);
  }

  _wire(tab) {
    const wc = tab.view.webContents;
    const id = tab.id;

    wc.on('did-start-loading', () => {
      if (tab.internal) return;
      this._patch(id, { loading: true, crashed: false });
    });
    wc.on('did-stop-loading', () => {
      if (tab.internal) return;
      this._patch(id, { loading: false });
    });
    wc.on('did-finish-load', () => {
      if (tab.internal) return;
      tab.retryAttempted = false;
      this._patch(id, { loading: false, crashed: false });
      const url = wc.getURL();
      const title = wc.getTitle();
      this._patch(id, { url, title, favicon: null, security: securityState(url) });
      if (!tab.private && this.history) this.history.record(url, title);
      this._applySiteFixes(tab);
    });
    wc.on('did-fail-load', (_e, code, desc, validatedURL, isMainFrame) => {
      if (tab.internal) return;
      if (!isMainFrame) return;
      if (code === -3) return; // aborted, benign
      // ERR_FAILED can be transient (network switch, aborted redirect, proxy).
      // Retry the main document once before showing an error.
      if (code === -2 && !tab.retryAttempted) {
        tab.retryAttempted = true;
        const target = validatedURL || tab.url;
        setTimeout(() => {
          try {
            if (!tab.view.webContents.isDestroyed()) {
              tab.view.webContents.loadURL(target).catch((error) => {
                this.logger.warn('Navigation retry failed', error.message);
              });
            }
          } catch {
            // ignore
          }
        }, 600);
        return;
      }
      this._patch(id, { loading: false, crashed: true, title: desc || 'Failed to load', url: validatedURL || tab.url });
    });
    wc.on('did-navigate', (_e, url, httpResponseCode) => {
      if (tab.internal) return;
      this._patch(id, { url, security: securityState(url) });
      void httpResponseCode;
    });
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (tab.internal) return;
      this._patch(id, { url, security: securityState(url) });
      if (isMainFrame !== false) this._applySiteFixes(tab);
    });
    wc.on('page-title-updated', (_e, title) => {
      if (tab.internal) return;
      this._patch(id, { title });
    });
    wc.on('page-favicon-updated', (_e, favicons) => {
      if (tab.internal) return;
      const icon = Array.isArray(favicons) && favicons.length ? favicons[favicons.length - 1] : null;
      this._patch(id, { favicon: icon });
    });
    wc.on('media-started-playing', () => this._patch(id, {}));
    wc.on('audio-state-changed', (event) => {
      this._patch(id, { audible: !!event.audible });
    });
    wc.on('render-process-gone', () => this._patch(id, { crashed: true, loading: false }));

    // Block navigation to dangerous top-level schemes; open safe externals in
    // the OS browser instead of inside an untrusted context.
    wc.on('will-navigate', (event, url) => {
      const scheme = (() => {
        try {
          return new URL(url).protocol;
        } catch {
          return '';
        }
      })();
      if (!['http:', 'https:', 'file:', 'piflex:', 'about:'].includes(scheme)) {
        event.preventDefault();
        if (isSafeExternalUrl(url)) shell.openExternal(url);
      }
    });
    wc.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) this.create({ url, active: true });
      return { action: 'deny' };
    });

    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || !isBrowserShortcut(input)) return;
      event.preventDefault();
      this.windowManager.send(IPC.browserShortcut, {
        key: input.key,
        code: input.code || '',
        ctrlKey: !!input.control,
        metaKey: !!input.meta,
        shiftKey: !!input.shift,
        altKey: !!input.alt,
      });
    });

    // Permission prompts run through the PermissionService via this callback.
    if (wc.session && this.onPermission) this.onPermission(wc.session);
  }

  /**
   * Site-specific, in-page fixes run only on the matching origin and only while
   * network ad blocking is enabled for that site.
   */
  _applySiteFixes(tab) {
    let url = '';
    try {
      url = tab.view.webContents.getURL();
    } catch {
      return;
    }
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return;
    }
    if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return;
    const settings = this.settings.get();
    if (!settings.privacy || !settings.privacy.adblock) return;
    if ((settings.sites?.adblockExempt || []).includes(host)) return;
    tab.view.webContents.executeJavaScript(YOUTUBE_AD_SCRIPT, true).catch(() => undefined);
  }

  _load(tab, input) {
    const resolved = this._resolveInput(input);
    if (resolved.error) {
      this._patch(tab.id, { crashed: true, title: resolved.error, url: tab.url });
      this._emitUpdate(tab.id);
      return;
    }
    if (!resolved.url) return;

    if (resolved.url.startsWith('piflex://')) {
      // Internal pages are rendered by the trusted React shell, never inside the
      // sandboxed web-content view. Blank the view to release the old page and
      // detach it so the shell UI is visible.
      tab.url = resolved.url;
      tab.security = securityState(resolved.url);
      tab.internal = true;
      tab.loading = false;
      tab.crashed = false;
      tab.title = '';
      tab.favicon = null;
      tab.view.webContents.loadURL('about:blank').catch(() => undefined);
      this.windowManager.detachView(tab.view);
      this._emitUpdate(tab.id);
      if (tab.id === this.activeTabId) this._broadcast();
      return;
    }

    tab.internal = false;
    tab.retryAttempted = false;
    tab.url = resolved.url;
    tab.security = securityState(resolved.url);
    tab.view.webContents.loadURL(resolved.url).catch((error) => {
      this.logger.warn('Navigation failed', error.message);
    });
    // A tab may have been internal (new-tab page) and therefore detached. When
    // it navigates to the web while active, attach its view immediately or the
    // page would load invisibly.
    if (tab.id === this.activeTabId && this.viewVisible) {
      this.windowManager.attachView(tab.view);
      this._applyBounds();
    }
  }

  navigate(id, input) {
    const tab = this.tabs.get(id);
    if (!tab) return null;
    this._load(tab, input);
    return this.serialize(id);
  }

  activate(id) {
    const tab = this.tabs.get(id);
    if (!tab) return null;
    this.activeTabId = id;
    if (tab.internal) {
      // Internal pages live in the shell renderer, not a native view. Detach
      // whichever view was visible so it does not cover the shell.
      this.windowManager.detachAttachedView();
      this.windowManager.detachView(tab.view);
    } else if (this.viewVisible) {
      this.windowManager.attachView(tab.view);
    } else {
      this.windowManager.detachView(tab.view);
    }
    this._applyBounds();
    this._broadcast();
    return this.serialize(id);
  }

  /**
   * Hide the active web view while shell chrome popups are open. Native views
   * always paint above the React shell, so menus/dialogs would otherwise be
   * invisible over a real page.
   */
  setViewVisible(visible) {
    this.viewVisible = visible !== false;
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (!tab || tab.internal) return;
    if (this.viewVisible) {
      this.windowManager.attachView(tab.view);
      this._applyBounds();
    } else {
      this.windowManager.detachView(tab.view);
    }
  }

  close(id) {
    const tab = this.tabs.get(id);
    if (!tab) return false;
    if (!tab.private && this.history) this.history.recordClosed(tab.url, tab.title);
    this.tabs.delete(id);
    this.order = this.order.filter((t) => t !== id);
    try {
      this.windowManager.detachView(tab.view);
      tab.view.webContents.close();
    } catch {
      // view already gone
    }
    this.onTabEvent({ type: 'removed', tabId: id });
    if (this.activeTabId === id) {
      const next = this.order[this.order.length - 1] || null;
      this.activeTabId = null;
      if (next) this.activate(next);
      else {
        this.windowManager.clearViews();
        this._broadcast();
      }
    }
    return true;
  }

  closeOthers(id) {
    for (const other of [...this.order]) {
      if (other !== id) this.close(other);
    }
  }

  move(id, toIndex) {
    const from = this.order.indexOf(id);
    if (from === -1) return;
    const to = Math.max(0, Math.min(this.order.length - 1, Number(toIndex) || 0));
    this.order.splice(from, 1);
    this.order.splice(to, 0, id);
    this._broadcast();
  }

  reorder(order) {
    if (!Array.isArray(order)) return;
    const valid = order.filter((id) => this.tabs.has(id));
    for (const id of this.order) if (!valid.includes(id)) valid.push(id);
    this.order = valid;
    this._broadcast();
  }

  navigateAction(id, action) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    const wc = tab.view.webContents;
    if (action === 'back' && canNavigate(wc, 'back')) wc.navigationHistory.goBack();
    else if (action === 'forward' && canNavigate(wc, 'forward')) wc.navigationHistory.goForward();
    else if (action === 'reload') wc.reload();
    else if (action === 'stop') wc.stop();
    else if (action === 'home') this.navigate(id, DEFAULT_URL);
    else if (action === 'devtools') wc.openDevTools({ mode: 'detach' });
  }

  duplicate(id) {
    const tab = this.tabs.get(id);
    if (!tab) return null;
    return this.create({ url: tab.url, private: tab.private, groupId: tab.groupId });
  }

  setPinned(id, pinned) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    tab.pinned = !!pinned;
    this._broadcast();
  }

  setMuted(id, muted) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    tab.muted = !!muted;
    tab.view.webContents.setAudioMuted(!!muted);
    this._broadcast();
  }

  setGroup(id, groupId) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    tab.groupId = groupId || null;
    this._broadcast();
  }

  setZoom(id, factor) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    tab.view.webContents.setZoomFactor(Math.max(0.25, Math.min(5, Number(factor) || 1)));
  }

  find(id, text, options = {}) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    tab.view.webContents.findInPage(text, options);
  }

  stopFind(id, action = 'clearSelection') {
    const tab = this.tabs.get(id);
    if (!tab) return;
    tab.view.webContents.stopFindInPage(action);
  }

  suspend(id) {
    const tab = this.tabs.get(id);
    if (!tab || tab.id === this.activeTabId) return;
    // Capturing and restoring a page's DOM is not lossless; we mark the tab for
    // the renderer to discard its view lazily on next activation instead.
    this._patch(id, { suspended: true });
  }

  setBounds(bounds) {
    this.viewBounds = bounds;
    this._applyBounds();
  }

  _applyBounds() {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (!tab || tab.internal || !this.viewVisible) return;
    this.windowManager.setViewBounds(tab.view, this.viewBounds);
  }

  _patch(id, patch) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    Object.assign(tab, patch);
    this._emitUpdate(id);
  }

  _emitUpdate(id) {
    this.onTabEvent({ type: 'updated', tab: this.serialize(id) });
  }

  _emitCreated(tab) {
    this.onTabEvent({ type: 'created', tab: this.serialize(tab.id) });
  }

  _broadcast() {
    this.onStateChange(this.serializeAll());
  }

  serialize(id) {
    const tab = this.tabs.get(id);
    if (!tab) return null;
    return this._toState(tab);
  }

  _toState(tab) {
    const wc = tab.view.webContents;
    let canGoBack = false;
    let canGoForward = false;
    try {
      canGoBack = canNavigate(wc, 'back');
      canGoForward = canNavigate(wc, 'forward');
    } catch {
      // webContents may be destroyed
    }
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title || displayHost(tab.url) || 'New Tab',
      favicon: tab.favicon || null,
      loading: tab.loading,
      canGoBack,
      canGoForward,
      audible: !!tab.audible,
      muted: !!tab.muted,
      private: tab.private,
      pinned: tab.pinned,
      groupId: tab.groupId,
      security: tab.security,
      crashed: !!tab.crashed,
      suspended: !!tab.suspended,
    };
  }

  serializeAll() {
    return {
      activeTabId: this.activeTabId,
      tabOrder: this.order.slice(),
      tabs: Object.fromEntries(this.order.map((id) => [id, this._toState(this.tabs.get(id))])),
    };
  }

  serializeActive() {
    return this.activeTabId ? this.serialize(this.activeTabId) : null;
  }

  listTabs() {
    return this.order.map((id) => this._toState(this.tabs.get(id)));
  }

  destroyAll() {
    for (const id of [...this.order]) this.close(id);
  }

  contextFor(id) {
    const tab = this.tabs.get(id);
    if (!tab) return null;
    const wc = tab.view.webContents;
    return { tab, wc, origin: originOf(tab.url), host: hostnameOf(tab.url) };
  }

  /**
   * Extract the visible text of a tab's page. This runs only when the user
   * explicitly asks the assistant about the page. The result is untrusted page
   * content and is sanitized / redacted before it reaches a model.
   */
  async extractPageText(id) {
    const tab = this.tabs.get(id);
    if (!tab) return null;
    const wc = tab.view.webContents;
    if (!wc || wc.isDestroyed()) return null;
    const url = tab.url;
    if (url.startsWith('piflex://') || url.startsWith('about:')) {
      return { url, title: tab.title || '', text: '' };
    }
    try {
      const text = await wc.executeJavaScript(PAGE_TEXT_SCRIPT, true);
      return { url, title: tab.title || '', text: String(text || '') };
    } catch (error) {
      this.logger.warn('Page text extraction failed', error.message);
      return null;
    }
  }

  /**
   * Read the user's current text selection, if any. Returns '' when nothing is
   * selected so the caller can fall back to full-page context.
   */
  async extractSelection(id) {
    const tab = this.tabs.get(id);
    if (!tab) return '';
    const wc = tab.view.webContents;
    if (!wc || wc.isDestroyed()) return '';
    if (tab.url.startsWith('piflex://')) return '';
    try {
      return String((await wc.executeJavaScript('String(window.getSelection ? window.getSelection().toString() : "")', true)) || '');
    } catch {
      return '';
    }
  }
}

module.exports = { TabManager, DEFAULT_URL };
