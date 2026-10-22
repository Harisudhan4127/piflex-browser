const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('piflexApi', {
    version: '1.3.0',

    // General
    getInfo: () => ipcRenderer.invoke('piflex:getInfo'),

    // Bookmarks
    bookmarksList: () => ipcRenderer.invoke('piflex:bookmarks:list'),
    bookmarksAdd: (item) => ipcRenderer.invoke('piflex:bookmarks:add', item),
    bookmarksRemove: (id) => ipcRenderer.invoke('piflex:bookmarks:remove', id),
    bookmarksHas: (url) => ipcRenderer.invoke('piflex:bookmarks:has', url),

    // History
    historyAdd: (entry) => ipcRenderer.invoke('piflex:history:add', entry),
    historySearch: (q) => ipcRenderer.invoke('piflex:history:search', q),
    historyRemove: (id) => ipcRenderer.invoke('piflex:history:remove', id),
    historyClear: (hours) => ipcRenderer.invoke('piflex:history:clear', hours),

    // Downloads
    downloadsList: () => ipcRenderer.invoke('piflex:downloads:list'),
    downloadsPause: (id) => ipcRenderer.invoke('piflex:downloads:pause', id),
    downloadsResume: (id) => ipcRenderer.invoke('piflex:downloads:resume', id),
    downloadsCancel: (id) => ipcRenderer.invoke('piflex:downloads:cancel', id),
    onDownloadEvent: (cb) => ipcRenderer.on('piflex:download-event', (_e, p) => cb(p)),

    // Adblock
    adblockStatus: () => ipcRenderer.invoke('piflex:adblock:status'),
    adblockSetEnabled: (v) => ipcRenderer.invoke('piflex:adblock:setEnabled', v),
    adblockSetSite: (host, exempt) => ipcRenderer.invoke('piflex:adblock:setSite', { host, exempt }),
    adblockUpdate: () => ipcRenderer.invoke('piflex:adblock:update'),
    adblockClearStats: () => ipcRenderer.invoke('piflex:adblock:clearStats'),
    onAdblockStatus: (cb) => ipcRenderer.on('piflex:adblock-status', (_e, s) => cb(s)),

    // Ollama reachability
    checkOllama: (host) => ipcRenderer.invoke('piflex:checkReachableOllama', host),
});

contextBridge.exposeInMainWorld('piflex', {
    version: '1.3.0',
    getVersion() { return this.version; },
});
