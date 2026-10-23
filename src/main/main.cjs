'use strict';

const path = require('path');
const { app, session, net, shell, nativeTheme } = require('electron');

const { ensureDirectories, getPaths, downloadDirectory } = require('./paths.cjs');
const { Logger } = require('./logger.cjs');
const { hardwareInfo, recommendedDiskCacheMB, recommendedMaxTabs } = require('./hardware.cjs');
const { PiFlexDatabase } = require('./db/database.cjs');
const { BookmarkService } = require('./db/bookmark-service.cjs');
const { HistoryService } = require('./db/history-service.cjs');
const { CredentialService } = require('./db/credential-service.cjs');
const { AutofillService } = require('./db/autofill-service.cjs');

const { SettingsService } = require('./services/settings-service.cjs');
const { WindowManager } = require('./services/window-manager.cjs');
const { TabManager, DEFAULT_URL } = require('./services/tab-manager.cjs');
const { AdblockService } = require('./services/adblock-service.cjs');
const { DownloadService } = require('./services/download-service.cjs');
const { PermissionService } = require('./services/permission-service.cjs');
const { ExtensionService } = require('./services/extension-service.cjs');
const { SearchService } = require('./services/search-service.cjs');
const { TrustService } = require('./services/trust-service.cjs');
const { AiService } = require('./services/ai-service.cjs');
const { ModelService } = require('./services/model-service.cjs');
const { RuntimeService } = require('./services/runtime-service.cjs');
const { registerIpc } = require('./ipc/register.cjs');
const { IPC } = require('../shared/ipc.cjs');
const { FILTER_LISTS } = require('../../core/adblock/lists');
const { normalizeCustomEngines, getEngine } = require('../../core/search');

const IS_SMOKE = process.argv.includes('--piflex-smoke-test');
const IS_SMOKE_WINDOW = process.argv.includes('--piflex-smoke-window');
const DEV_SERVER = process.env.PIFLEX_DEV_SERVER || null;

// Single-instance guard; a second launch focuses the existing window.
if (!IS_SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
}

const APP_ROOT = path.join(__dirname, '..', '..');

class PiFlexApp {
  constructor() {
    this.services = {};
    this.smoke = IS_SMOKE;
  }

  async init() {
    const paths = ensureDirectories();
    this.paths = paths;

    const settings = new SettingsService(paths.settings, new Logger(null, 'warn'));
    const logger = new Logger(
      path.join(paths.logs, 'piflex.log'),
      settings.get().advanced.logLevel || 'warn',
    );
    this.services.logger = logger;

    // Persisted stores.
    const db = new PiFlexDatabase(paths.db);
    logger.info('Database available:', db.available, db.error || '');

    this.services.settings = settings;
    this.services.db = db;
    this.services.bookmarks = new BookmarkService(db);
    this.services.history = new HistoryService(db, { enabled: settings.get().privacy.historyEnabled });
    this.services.credentials = new CredentialService(db, logger);
    this.services.autofill = new AutofillService(db, logger);

    // Windows + sessions.
    this.services.windows = new WindowManager({
      preloadPath: path.join(APP_ROOT, 'src', 'preload', 'index.cjs'),
      devServerUrl: DEV_SERVER,
      shellFile: path.join(APP_ROOT, 'dist', 'renderer', 'index.html'),
      logger,
    });

    this._configureSessions(settings);

    // Network-level protections and downloads attach to the shared session.
    const shared = session.fromPartition('persist:piflex');
    this.services.adblock = new AdblockService({
      session: shared,
      settingsService: settings,
      filtersDir: paths.filters,
      cacheDir: paths.cache,
      logger,
      net,
      onStats: (stats) => this.services.windows.send(IPC.privacyStats, stats),
    });

    this.services.downloads = new DownloadService({
      db,
      settingsService: settings,
      downloadDirectory,
      logger,
      shell,
      onUpdate: (item) => this.services.windows.send(IPC.downloadUpdated, item),
    });
    this.services.downloads.attach(shared);

    this.services.permissions = new PermissionService({ settingsService: settings, logger });
    this.services.permissions.onRequest((request) =>
      this.services.windows.send(IPC.permissionRequested, request),
    );
    this.services.permissions.attach(shared);
    this.services.permissions.attach(session.fromPartition('piflex-private'));

    this.services.extensions = new ExtensionService({
      session: shared,
      extensionsDir: paths.extensions,
      logger,
    });

    this.services.search = new SearchService({
      settingsService: settings,
      bookmarkService: this.services.bookmarks,
      historyService: this.services.history,
    });

    this.services.trust = new TrustService({
      historyService: this.services.history,
      downloadService: this.services.downloads,
      credentialService: this.services.credentials,
      autofillService: this.services.autofill,
      sessions: [shared, session.fromPartition('piflex-private')],
      logger,
    });

    this.services.models = new ModelService({
      modelsDir: paths.models,
      logger,
      net,
      onProgress: (payload) => this.services.windows.send(IPC.aiModelProgress, payload),
    });
    this.services.runtime = new RuntimeService({
      runtimeDir: paths.runtime,
      logger,
      net,
      onProgress: (payload) => this.services.windows.send(IPC.aiModelProgress, payload),
    });
    this.services.ai = new AiService({
      settingsService: settings,
      modelsDir: paths.models,
      runtimeDir: paths.runtime,
      runtimeService: this.services.runtime,
      modelService: this.services.models,
      logger,
      net,
      onStatus: (status) => this.services.windows.send(IPC.aiStatus, status),
      onStream: (payload) => this.services.windows.send(IPC.aiStream, payload),
    });

    this.services.hardwareInfo = () => ({
      ...hardwareInfo(),
      recommendedDiskCacheMB: recommendedDiskCacheMB(settings.get().advanced.diskCacheMB),
      recommendedMaxTabs: recommendedMaxTabs(),
    });
    this.services.diagnostics = () => {
      const metrics = app.getAppMetrics().map((metric) => ({
        pid: metric.pid,
        type: metric.type,
        name: metric.name || metric.serviceName || metric.type,
        memoryMB: Math.round(((metric.memory && metric.memory.workingSetSize) || 0) / 1024),
        cpuPercent: Math.round(((metric.cpu && metric.cpu.percentCPUUsage) || 0) * 10) / 10,
      }));
      const totalAppMB = metrics.reduce((sum, item) => sum + item.memoryMB, 0);
      const tabs = this.services.tabs.listTabs();
      const mainUsage = process.memoryUsage();
      return {
        processes: metrics,
        appMemoryMB: totalAppMB,
        mainHeapMB: Math.round(mainUsage.heapUsed / (1024 * 1024)),
        system: hardwareInfo(),
        tabs: {
          total: tabs.length,
          active: tabs.filter((t) => t.id === this.services.tabs.activeTabId).length,
          private: tabs.filter((t) => t.private).length,
          internal: tabs.filter((t) => String(t.url).startsWith('piflex://')).length,
          suspended: tabs.filter((t) => t.suspended).length,
        },
        ai: this.services.ai.status,
        adblock: this.services.adblock.statusFor(''),
      };
    };
    this.services.filterListCatalog = () => {
      const enabled = new Set(settings.get().privacy.filterListIds || []);
      return FILTER_LISTS.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        category: l.category,
        enabled: enabled.has(l.id),
      }));
    };

    // Tabs are created once the window exists (they need a content view).
    this.services.tabs = new TabManager({
      windowManager: this.services.windows,
      settingsService: settings,
      historyService: this.services.history,
      logger,
      defaultSearchEngine: () =>
        getEngine(settings.get().search.engineId, normalizeCustomEngines(settings.get().search.custom)),
      onStateChange: (state) => this.services.windows.send(IPC.windowState, state),
      onTabEvent: (event) => {
        if (event.type === 'updated') this.services.windows.send(IPC.tabUpdated, event.tab);
        else if (event.type === 'created') this.services.windows.send(IPC.tabCreated, event.tab);
        else if (event.type === 'removed') this.services.windows.send(IPC.tabRemoved, event.tabId);
      },
      onPermission: (ses) => this.services.permissions.attach(ses),
      onDownload: () => {},
    });

    this.services.onNewWindow = (isPrivate) => this.openWindow({ private: isPrivate });

    registerIpc(this.services, {
      onTabActivate: (id) => this.services.tabs.activate(id),
      onPermissionRespond: (payload) => this.services.permissions.respond(payload.id, payload),
      onAiCancel: () => this.services.ai.cancel(),
    });

    // React to settings changes that require live reconfiguration.
    settings.onChange((next, keys) => {
      if (keys.includes('logLevel') || keys.includes('advanced')) logger.setLevel(next.advanced.logLevel);
      if (keys.includes('theme')) this.services.windows.setTheme(next.theme);
      nativeTheme.themeSource = next.theme === 'system' ? 'system' : next.theme;
      this.services.history.setEnabled(next.privacy.historyEnabled);
    });

    await this.services.adblock.init();
    await this.services.extensions.loadAll().catch((error) => logger.warn('Extensions:', error.message));

    // Optional: restore or open a first tab is deferred until window creation.
    return this;
  }

  _configureSessions(settings) {
    for (const partition of ['persist:piflex', 'piflex-private']) {
      const ses = session.fromPartition(partition);
      const diskCacheMB = recommendedDiskCacheMB(settings.get().advanced.diskCacheMB);
      try {
        ses.setCacheSize?.(diskCacheMB * 1024 * 1024);
      } catch {
        // not all Electron builds expose setCacheSize
      }
      const ua = ses.getUserAgent().replace(/Electron\/[\d.]+ /, '').replace(/PiFlex\/[\d.]+ /, '') + ' PiFlex';
      ses.setUserAgent(ua);
      // Strip identifying headers where the engine allows it.
      ses.webRequest.onBeforeSendHeaders({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
        const headers = details.requestHeaders;
        if (settings.get().privacy.sendDoNotTrack) {
          headers['DNT'] = '1';
          headers['Sec-GPC'] = '1';
        }
        callback({ requestHeaders: headers });
      });
    }
  }

  openWindow({ private: isPrivate = false } = {}) {
    const window = this.services.windows.create({});
    window.webContents.once('did-finish-load', () => {
      // Open a first tab after the shell has loaded and can receive events.
      const restored = this._restoreSessionTabs(isPrivate);
      if (!restored) this.services.tabs.create({ url: DEFAULT_URL, active: true, background: true });
      this.services.windows.send(IPC.windowState, this.services.tabs.serializeAll());
    });
    return window;
  }

  _restoreSessionTabs(isPrivate) {
    const settings = this.services.settings.get();
    if (isPrivate || !settings.startup.restoreSession) return false;
    return false; // session persistence of open tabs is a follow-up; never fabricate state
  }

  async run() {
    await app.whenReady();
    await this.init();
    if (this.smoke && !IS_SMOKE_WINDOW) {
      // Headless smoke: initialise everything, then exit cleanly.
      this.services.logger.info('Smoke test complete (no window)');
      setTimeout(() => app.quit(), 300);
      return;
    }
    this.openWindow({});
    this.services.windows.setTheme(this.services.settings.get().theme);
    // Zero-config first run: install the local AI runtime and a small model in
    // the background. Progress is streamed to the shell; failures stay silent
    // until the user opens the assistant.
    setTimeout(() => {
      void this.services.ai.autoProvision().catch((error) => {
        this.services.logger.warn('AI auto setup:', error.message);
      });
    }, 2500);

    if (this.smoke && IS_SMOKE_WINDOW) {
      // Windowed smoke: surface renderer errors, then exit so CI does not hang.
      const w = this.services.windows.window;
      w.webContents.on('console-message', (event) => {
        const severity = typeof event.level === 'number' ? event.level : 0;
        if (severity >= 2) console.error('[renderer]', event.message);
      });
      w.webContents.once('did-finish-load', async () => {
        this.services.logger.info('Smoke window loaded');
        // Exercise an internal page so a broken bridge/render path fails the smoke test.
        const active = this.services.tabs.activeTabId;
        if (active) this.services.tabs.navigate(active, 'piflex://settings');
        const deadline = Date.now() + 5000;
        let ok = false;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 250));
          try {
            const text = await w.webContents.executeJavaScript('document.body.innerText', true);
            if (typeof text === 'string' && text.includes('Settings') && !text.includes('Loading settings')) {
              ok = true;
              break;
            }
          } catch {
            // renderer not ready yet
          }
        }
        this.services.logger.info(ok ? 'Smoke internal page OK' : 'Smoke internal page FAILED');
        console.log(`[smoke] internal page ${ok ? 'OK' : 'FAILED'}`);
        app.exit(ok ? 0 : 1);
      });
      setTimeout(() => app.quit(), 8000);
    }

    app.on('activate', () => {
      if (!this.services.windows.window) this.openWindow({});
    });
  }

  shutdown() {
    try {
      this.services.tabs.destroyAll();
    } catch {
      // ignore
    }
    try {
      this.services.ai.destroy();
      this.services.models.cancel();
      this.services.adblock.destroy();
      this.services.db.close();
    } catch {
      // ignore
    }
  }
}

const piflex = new PiFlexApp();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => piflex.shutdown());
app.on('second-instance', () => {
  if (piflex.services.windows && piflex.services.windows.window) {
    const w = piflex.services.windows.window;
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

piflex.run().catch((error) => {
  console.error('PiFlex failed to start:', error);
  app.exit(1);
});

module.exports = { PiFlexApp };
