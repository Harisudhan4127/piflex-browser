'use strict';

const { dialog, app } = require('electron');
const { IPC } = require('../../shared/ipc.cjs');

/**
 * Registers every privileged IPC handler. Each handler is wrapped so that the
 * renderer always receives a consistent { ok, data } / { ok, error } envelope,
 * and so a thrown error never crashes the main process.
 */
function registerIpc(services, { onTabActivate, onPermissionRespond, onAiCancel }) {
  const { ipcMain } = require('electron');

  const handle = (channel, fn) => {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        const data = await fn(payload, _event);
        return { ok: true, data: data === undefined ? null : data };
      } catch (error) {
        services.logger.warn(`IPC ${channel} failed:`, error.message);
        return { ok: false, error: String(error.message || error) };
      }
    });
  };

  // ---- app ----------------------------------------------------------------
  handle(IPC.appInfo, () => ({
    name: 'PiFlex',
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
  }));
  ipcMain.on(IPC.appQuit, () => app.quit());

  // ---- window -------------------------------------------------------------
  ipcMain.on(IPC.windowMinimize, () => services.windows.minimize());
  ipcMain.on(IPC.windowMaximize, () => services.windows.toggleMaximize());
  ipcMain.on(IPC.windowClose, () => services.windows.close());
  handle(IPC.windowIsMaximized, () => services.windows.isMaximized());
  ipcMain.on(IPC.windowNew, () => services.onNewWindow && services.onNewWindow(false));
  ipcMain.on(IPC.windowNewPrivate, () => services.onNewWindow && services.onNewWindow(true));
  ipcMain.on(IPC.layoutSetToolbarHeight, (_e, payload = {}) => {
    // The renderer measures its chrome and reports the content viewport rect.
    if (payload.bounds) services.tabs.setBounds(payload.bounds);
    else if (typeof payload.height === 'number') services.tabs.setBounds({ x: 0, y: payload.height, width: payload.width || 0, height: payload.viewportHeight || 0 });
  });
  ipcMain.on(IPC.layoutSetViewVisible, (_e, payload = {}) => {
    // Chrome popups (menus, dialogs, address suggestions) render in the shell,
    // which sits *below* native web views. Temporarily hide the view so those
    // popups are not occluded, then restore it when they close.
    services.tabs.setViewVisible(payload.visible !== false);
  });

  // ---- tabs ---------------------------------------------------------------
  handle(IPC.tabList, () => services.tabs.listTabs());
  handle(IPC.windowState, () => services.tabs.serializeAll());
  handle(IPC.tabCreate, ({ url, private: isPrivate } = {}) => services.tabs.create({ url, private: isPrivate }));
  handle(IPC.tabClose, ({ id }) => services.tabs.close(id));
  ipcMain.on(IPC.tabActivate, (_e, { id } = {}) => onTabActivate(id));
  handle(IPC.tabNavigate, ({ id, input }) => services.tabs.navigate(id, input));
  handle(IPC.tabBack, ({ id }) => (services.tabs.navigateAction(id, 'back'), services.tabs.serialize(id)));
  handle(IPC.tabForward, ({ id }) => (services.tabs.navigateAction(id, 'forward'), services.tabs.serialize(id)));
  handle(IPC.tabReload, ({ id }) => (services.tabs.navigateAction(id, 'reload'), services.tabs.serialize(id)));
  handle(IPC.tabStop, ({ id }) => (services.tabs.navigateAction(id, 'stop'), services.tabs.serialize(id)));
  handle(IPC.tabHome, ({ id }) => services.tabs.navigate(id, 'piflex://newtab'));
  handle(IPC.tabDuplicate, ({ id }) => services.tabs.duplicate(id));
  handle(IPC.tabCloseOthers, ({ id }) => (services.tabs.closeOthers(id), true));
  handle(IPC.tabMove, ({ id, toIndex }) => (services.tabs.move(id, toIndex), true));
  handle(IPC.tabPin, ({ id, pinned }) => (services.tabs.setPinned(id, pinned), true));
  handle(IPC.tabMute, ({ id, muted }) => (services.tabs.setMuted(id, muted), true));
  handle(IPC.tabZoom, ({ id, factor }) => (services.tabs.setZoom(id, factor), true));
  ipcMain.on(IPC.tabFind, (_e, { id, text } = {}) => services.tabs.find(id, text || ''));
  ipcMain.on(IPC.tabFindStop, (_e, { id, action } = {}) => services.tabs.stopFind(id, action || 'clearSelection'));
  handle(IPC.tabReorder, ({ order }) => (services.tabs.reorder(order), true));
  handle(IPC.tabSetGroup, ({ id, groupId }) => (services.tabs.setGroup(id, groupId), true));

  // ---- search -------------------------------------------------------------
  handle(IPC.searchSuggest, ({ query }) => services.search.suggest(query));
  handle(IPC.searchResolve, ({ input }) => services.search.resolve(input));
  handle(IPC.searchEngines, () => services.search.engines());

  // ---- bookmarks ----------------------------------------------------------
  handle(IPC.bookmarksList, () => services.bookmarks.list());
  handle(IPC.bookmarksAdd, ({ url, title, folder }) => services.bookmarks.add({ url, title, folder }));
  handle(IPC.bookmarksUpdate, ({ id, patch }) => services.bookmarks.update(id, patch));
  handle(IPC.bookmarksRemove, ({ id }) => services.bookmarks.remove(id));
  handle(IPC.bookmarksMove, ({ id, folder, position }) => services.bookmarks.move(id, folder, position));
  handle(IPC.bookmarksFolders, () => services.bookmarks.folders());
  handle(IPC.bookmarksContains, ({ url }) => services.bookmarks.contains(url));
  handle(IPC.bookmarksExport, () => services.bookmarks.exportItems());
  handle(IPC.bookmarksImport, ({ items }) => services.bookmarks.importItems(items));

  // ---- history ------------------------------------------------------------
  handle(IPC.historyList, ({ since = 0, limit = 500 } = {}) => services.history.list({ since, limit }));
  handle(IPC.historySearch, ({ query }) => services.history.search(query));
  handle(IPC.historyRemove, ({ ids }) => services.history.remove(ids));
  handle(IPC.historyClear, ({ since = 0 } = {}) => services.history.clear({ since }));
  handle(IPC.historyRecentlyClosed, () => services.history.recentlyClosed());

  // ---- top sites ----------------------------------------------------------
  handle(IPC.topSitesList, () => services.history.topSites({ limit: 12 }));
  handle(IPC.topSitesPin, ({ host, pinned }) => (services.history.pin(host, pinned), true));
  handle(IPC.topSitesRemove, ({ host }) => (services.history.removeTopSite(host), true));

  // ---- downloads ----------------------------------------------------------
  handle(IPC.downloadsList, () => services.downloads.list());
  handle(IPC.downloadsPause, ({ id }) => services.downloads.pause(id));
  handle(IPC.downloadsResume, ({ id }) => services.downloads.resume(id));
  handle(IPC.downloadsCancel, ({ id }) => services.downloads.cancel(id));
  handle(IPC.downloadsRemove, ({ id }) => services.downloads.remove(id));
  handle(IPC.downloadsOpen, ({ id }) => services.downloads.open(id));
  handle(IPC.downloadsShow, ({ id }) => services.downloads.showInFolder(id));
  handle(IPC.downloadsRetry, ({ id }) => services.downloads.retry(id));

  // ---- settings -----------------------------------------------------------
  handle(IPC.settingsGet, () => services.settings.get());
  handle(IPC.settingsUpdate, ({ patch }) => services.settings.update(patch));
  handle(IPC.settingsReset, () => services.settings.reset());
  handle(IPC.hardwareInfo, () => services.hardwareInfo());
  handle(IPC.diagnosticsGet, () => services.diagnostics());

  // ---- privacy ------------------------------------------------------------
  handle(IPC.privacyStatus, ({ url }) => services.adblock.statusFor(url || ''));
  handle(IPC.privacySetEnabled, ({ enabled }) => {
    services.settings.setPrivacy({ adblock: !!enabled });
    return services.adblock.statusFor('');
  });
  handle(IPC.privacyFilterLists, () => services.filterListCatalog());
  handle(IPC.privacySetFilterLists, async ({ ids }) => {
    services.settings.setPrivacy({ filterListIds: ids || [] });
    await services.adblock.loadRules();
    return services.adblock.statusFor('');
  });
  handle(IPC.privacyToggleSite, ({ url, exempt }) => services.adblock.toggleSite(url, exempt));
  handle(IPC.privacyUpdateLists, () => services.adblock.updateLists());
  handle(IPC.privacyClearData, (options) => services.trust.clear(options));
  handle(IPC.privacyStats, () => services.adblock.getStats());

  // ---- permissions --------------------------------------------------------
  handle(IPC.permissionsList, () => services.permissions.list());
  handle(IPC.permissionsSet, ({ origin, permission, decision }) => services.permissions.set(origin, permission, decision));
  handle(IPC.permissionsClear, ({ origin, permission } = {}) => services.permissions.clear(origin, permission));
  ipcMain.on(IPC.permissionsRespond, (_e, payload = {}) => onPermissionRespond(payload));

  // ---- credentials --------------------------------------------------------
  handle(IPC.credentialsVaultAvailable, () => services.credentials.vaultAvailable);
  handle(IPC.credentialsList, () => services.credentials.list());
  handle(IPC.credentialsReveal, ({ id }) => services.credentials.reveal(id));
  handle(IPC.credentialsSave, (payload) => services.credentials.save(payload));
  handle(IPC.credentialsUpdate, ({ id, patch }) => services.credentials.update(id, patch));
  handle(IPC.credentialsRemove, ({ id }) => services.credentials.remove(id));
  handle(IPC.credentialsGenerate, (options) => services.credentials.generate(options || {}));

  // ---- autofill -----------------------------------------------------------
  handle(IPC.autofillList, () => services.autofill.list());
  handle(IPC.autofillSave, (profile) => services.autofill.save(profile || {}));
  handle(IPC.autofillRemove, ({ id }) => services.autofill.remove(id));

  // ---- extensions ---------------------------------------------------------
  handle(IPC.extensionsList, () => services.extensions.list());
  handle(IPC.extensionsInstall, async () => {
    const result = await dialog.showOpenDialog(services.windows.window, { properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    return services.extensions.installFromDirectory(result.filePaths[0]);
  });
  handle(IPC.extensionsRemove, ({ id }) => services.extensions.remove(id));
  handle(IPC.extensionsSetEnabled, ({ id, enabled }) => services.extensions.setEnabled(id, enabled));
  handle(IPC.extensionsSetToolbar, ({ id, visible }) => services.extensions.setToolbarVisible(id, visible));

  // ---- AI -----------------------------------------------------------------
  handle(IPC.aiStatus, () => services.ai.status);
  handle(IPC.aiChat, async (payload = {}) => {
    const { requestId, tabId, history, userText, selectionText, includePage } = payload;
    const activeId = tabId || services.tabs.activeTabId;
    let pageText = '';
    let pageTitle = '';
    let selection = String(selectionText || '');
    if (includePage && activeId) {
      const extracted = await services.tabs.extractPageText(activeId);
      if (extracted) {
        pageText = extracted.text;
        pageTitle = extracted.title;
      }
      if (!selection) selection = await services.tabs.extractSelection(activeId);
    }
    return services.ai.chat(requestId, { history, userText, pageText, pageTitle, selectionText: selection });
  });
  ipcMain.on(IPC.aiChatCancel, () => onAiCancel());
  handle(IPC.aiModels, () => ({ catalog: services.models.catalog(), installed: services.models.installed() }));
  handle(IPC.aiDownloadModel, ({ modelId }) => services.models.download(modelId, 'model-download'));
  handle(IPC.aiEnsureRuntime, async () => {
    const executable = await services.runtime.ensure();
    return { ...services.runtime.status(), executable };
  });
  handle(IPC.aiPageText, async ({ tabId } = {}) => {
    const activeId = tabId || services.tabs.activeTabId;
    if (!activeId) return { url: '', title: '', text: '' };
    return (await services.tabs.extractPageText(activeId)) || { url: '', title: '', text: '' };
  });
  handle(IPC.aiSelectionText, async ({ tabId } = {}) => {
    const activeId = tabId || services.tabs.activeTabId;
    if (!activeId) return '';
    return services.tabs.extractSelection(activeId);
  });

  // ---- shell --------------------------------------------------------------
  handle(IPC.openExternal, ({ url }) => services.windows.openExternal(url));

  return () => {
    for (const value of Object.values(IPC)) {
      try {
        ipcMain.removeHandler(value);
      } catch {
        // not a handle channel
      }
    }
  };
}

module.exports = { registerIpc };
