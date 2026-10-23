// Canonical IPC channel names. Sharing this module between the preload bridge
// and the main process prevents channel-name drift and makes the privileged
// surface auditable in one place.

const IPC = {
  // window / app
  appInfo: 'app:info',
  appQuit: 'app:quit',
  windowMinimize: 'window:minimize',
  windowMaximize: 'window:maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  windowNew: 'window:new',
  windowNewPrivate: 'window:new-private',

  // tabs (main owns web contents)
  tabList: 'tabs:list',
  tabCreate: 'tabs:create',
  tabClose: 'tabs:close',
  tabActivate: 'tabs:activate',
  tabNavigate: 'tabs:navigate',
  tabBack: 'tabs:back',
  tabForward: 'tabs:forward',
  tabReload: 'tabs:reload',
  tabStop: 'tabs:stop',
  tabHome: 'tabs:home',
  tabDuplicate: 'tabs:duplicate',
  tabCloseOthers: 'tabs:close-others',
  tabMove: 'tabs:move',
  tabPin: 'tabs:pin',
  tabMute: 'tabs:mute',
  tabSuspend: 'tabs:suspend',
  tabZoom: 'tabs:zoom',
  tabFind: 'tabs:find',
  tabFindStop: 'tabs:find-stop',
  tabReorder: 'tabs:reorder',
  tabSetGroup: 'tabs:set-group',

  // navigation / layout (main must reposition active WebContentsView)
  layoutSetToolbarHeight: 'layout:set-toolbar-height',
  layoutSetViewVisible: 'layout:set-view-visible',

  // page events pushed from main -> renderer
  tabUpdated: 'tabs:updated',
  tabRemoved: 'tabs:removed',
  tabCreated: 'tabs:created',
  windowState: 'window:state',
  windowMaximized: 'window:maximized',
  findResult: 'tab:find-result',
  permissionRequested: 'permissions:requested',
  downloadUpdated: 'downloads:updated',
  privacyStats: 'privacy:stats',
  aiStream: 'ai:stream',
  browserShortcut: 'browser:shortcut',

  // suggestions / search
  searchSuggest: 'search:suggest',
  searchResolve: 'search:resolve',
  searchEngines: 'search:engines',

  // bookmarks
  bookmarksList: 'bookmarks:list',
  bookmarksAdd: 'bookmarks:add',
  bookmarksUpdate: 'bookmarks:update',
  bookmarksRemove: 'bookmarks:remove',
  bookmarksMove: 'bookmarks:move',
  bookmarksFolders: 'bookmarks:folders',
  bookmarksImport: 'bookmarks:import',
  bookmarksExport: 'bookmarks:export',
  bookmarksContains: 'bookmarks:contains',

  // history
  historyList: 'history:list',
  historySearch: 'history:search',
  historyRemove: 'history:remove',
  historyClear: 'history:clear',
  historyRecentlyClosed: 'history:recently-closed',

  // top sites
  topSitesList: 'topsites:list',
  topSitesPin: 'topsites:pin',
  topSitesRemove: 'topsites:remove',

  // downloads
  downloadsList: 'downloads:list',
  downloadsCancel: 'downloads:cancel',
  downloadsPause: 'downloads:pause',
  downloadsResume: 'downloads:resume',
  downloadsRemove: 'downloads:remove',
  downloadsOpen: 'downloads:open',
  downloadsShow: 'downloads:show',
  downloadsRetry: 'downloads:retry',

  // settings
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsReset: 'settings:reset',
  hardwareInfo: 'hardware:info',

  // privacy / adblock
  privacyStatus: 'privacy:status',
  privacySetEnabled: 'privacy:set-enabled',
  privacyFilterLists: 'privacy:filter-lists',
  privacySetFilterLists: 'privacy:set-filter-lists',
  privacyToggleSite: 'privacy:toggle-site',
  privacyUpdateLists: 'privacy:update-lists',
  privacyClearData: 'privacy:clear-data',

  // permissions
  permissionsList: 'permissions:list',
  permissionsSet: 'permissions:set',
  permissionsClear: 'permissions:clear',
  permissionsRespond: 'permissions:respond',

  // credentials
  credentialsList: 'credentials:list',
  credentialsReveal: 'credentials:reveal',
  credentialsSave: 'credentials:save',
  credentialsUpdate: 'credentials:update',
  credentialsRemove: 'credentials:remove',
  credentialsGenerate: 'credentials:generate',
  credentialsVaultAvailable: 'credentials:vault-available',

  // autofill
  autofillList: 'autofill:list',
  autofillSave: 'autofill:save',
  autofillRemove: 'autofill:remove',

  // extensions
  extensionsList: 'extensions:list',
  extensionsInstall: 'extensions:install',
  extensionsRemove: 'extensions:remove',
  extensionsSetEnabled: 'extensions:set-enabled',
  extensionsSetToolbar: 'extensions:set-toolbar',
  extensionsPickDir: 'extensions:pick-dir',

  // AI
  aiStatus: 'ai:status',
  aiChat: 'ai:chat',
  aiChatCancel: 'ai:chat-cancel',
  aiModels: 'ai:models',
  aiDownloadModel: 'ai:download-model',
  aiEnsureRuntime: 'ai:ensure-runtime',
  aiPageText: 'ai:page-text',
  aiSelectionText: 'ai:selection-text',
  aiModelProgress: 'ai:model-progress',

  // shell
  openExternal: 'shell:open-external',
  showItemInFolder: 'shell:show-item',
  setTheme: 'shell:set-theme',

  // diagnostics
  diagnosticsGet: 'diagnostics:get',
};



// Channels the renderer may push to the main process (ipcRenderer.send).
const SEND_CHANNELS = [
  IPC.appQuit,
  IPC.windowMinimize,
  IPC.windowMaximize,
  IPC.windowClose,
  IPC.windowNew,
  IPC.windowNewPrivate,
  IPC.layoutSetToolbarHeight,
  IPC.layoutSetViewVisible,
  IPC.tabActivate,
  IPC.tabClose,
  IPC.tabFind,
  IPC.tabFindStop,
  IPC.permissionsRespond,
  IPC.aiChatCancel,
  IPC.setTheme,
];

// Channels the main process may push to the renderer (webContents.send).
const PUSH_CHANNELS = [
  IPC.tabUpdated,
  IPC.tabRemoved,
  IPC.tabCreated,
  IPC.windowState,
  IPC.windowMaximized,
  IPC.findResult,
  IPC.permissionRequested,
  IPC.downloadUpdated,
  IPC.privacyStats,
  IPC.aiStream,
  IPC.aiStatus,
  IPC.aiModelProgress,
  IPC.browserShortcut,
];


module.exports = { IPC, SEND_CHANNELS, PUSH_CHANNELS };
