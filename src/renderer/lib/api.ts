// The renderer never imports IPC channel strings directly. The preload exposes
// the canonical channel map on window.piflex.channels, so the browser service
// wrapper below is the single typed entry point to privileged operations.

import type {
  AppInfo,
  AdblockStatus,
  AutofillProfile,
  Bookmark,
  ClearDataOptions,
  CredentialSecret,
  CredentialSummary,
  DownloadItem,
  DiagnosticsInfo,
  ExtensionInfo,
  HardwareInfo,
  HistoryEntry,
  PermissionOverride,
  PrivacyStats,
  Suggestion,
  TabState,
  TopSite,
  WindowState,
  SearchEngine,
  AiStatus,
  AiModelInfo,
  AiInstalledModel,
  AiDownloadResult,
  AiModelProgress,
  SettingsData,
} from '@shared/types';

interface PiFlexChannels {
  [key: string]: string;
}

interface PiFlexBridge {
  invoke<T = unknown>(channel: string, payload?: unknown): Promise<T>;
  send(channel: string, payload?: unknown): void;
  on(channel: string, listener: (payload: unknown) => void): () => void;
  channels: PiFlexChannels;
  platform: string;
  setTheme(theme: string): void;
  openExternal(url: string): Promise<boolean>;
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    newWindow(): void;
    newPrivateWindow(): void;
    setToolbarHeight(height: number): void;
    onMaximized(fn: (value: boolean) => void): () => void;
    onState(fn: (value: unknown) => void): () => void;
  };
}

declare global {
  interface Window {
    piflex: PiFlexBridge;
  }
}

function bridge(): PiFlexBridge {
  if (typeof window === 'undefined' || !window.piflex) {
    throw new Error('The PiFlex preload bridge is unavailable');
  }
  return window.piflex;
}

function ch(name: string): string {
  const value = bridge().channels[name];
  if (!value) throw new Error(`Unknown IPC channel "${name}"`);
  return value;
}

const call = <T>(name: string, payload?: unknown): Promise<T> =>
  bridge().invoke<T>(ch(name), payload);

const tell = (name: string, payload?: unknown): void => bridge().send(ch(name), payload);

const listen = (name: string, fn: (payload: unknown) => void): (() => void) =>
  bridge().on(ch(name), fn);

export const piflex = {
  platform: (): string => bridge().platform,
  setTheme: (theme: string): void => bridge().setTheme(theme),
  openExternal: (url: string): Promise<boolean> => call('openExternal', { url }),
  raw: {
    invoke: <T>(name: string, payload?: unknown) => call<T>(name, payload),
    send: (name: string, payload?: unknown) => tell(name, payload),
    on: (name: string, fn: (payload: unknown) => void) => listen(name, fn),
  },
};

export const win = {
  minimize: () => bridge().window.minimize(),
  toggleMaximize: () => bridge().window.toggleMaximize(),
  close: () => bridge().window.close(),
  isMaximized: () => bridge().window.isMaximized(),
  newWindow: () => bridge().window.newWindow(),
  newPrivateWindow: () => bridge().window.newPrivateWindow(),
  setToolbarHeight: (height: number) => bridge().window.setToolbarHeight(height),
  setViewVisible: (visible: boolean) => tell('layoutSetViewVisible', { visible }),
  onMaximized: (fn: (value: boolean) => void) => bridge().window.onMaximized(fn),
};

export const tabs = {
  list: () => call<TabState[]>('tabList'),
  state: () => call<WindowState>('windowState'),
  create: (url?: string, isPrivate = false) => call<TabState>('tabCreate', { url, private: isPrivate }),
  close: (id: string) => call<boolean>('tabClose', { id }),
  activate: (id: string) => tell('tabActivate', { id }),
  navigate: (id: string, input: string) => call<TabState>('tabNavigate', { id, input }),
  back: (id: string) => call<TabState>('tabBack', { id }),
  forward: (id: string) => call<TabState>('tabForward', { id }),
  reload: (id: string) => call<TabState>('tabReload', { id }),
  stop: (id: string) => call<TabState>('tabStop', { id }),
  home: (id: string) => call<TabState>('tabHome', { id }),
  duplicate: (id: string) => call<TabState>('tabDuplicate', { id }),
  closeOthers: (id: string) => call<boolean>('tabCloseOthers', { id }),
  move: (id: string, toIndex: number) => call<boolean>('tabMove', { id, toIndex }),
  pin: (id: string, pinned: boolean) => call<boolean>('tabPin', { id, pinned }),
  mute: (id: string, muted: boolean) => call<boolean>('tabMute', { id, muted }),
  zoom: (id: string, factor: number) => call<boolean>('tabZoom', { id, factor }),
  find: (id: string, text: string) => tell('tabFind', { id, text }),
  findStop: (id: string, action?: string) => tell('tabFindStop', { id, action }),
  reorder: (order: string[]) => call<boolean>('tabReorder', { order }),
  setGroup: (id: string, groupId: string | null) => call<boolean>('tabSetGroup', { id, groupId }),
  onUpdated: (fn: (tab: TabState) => void) => listen('tabUpdated', fn as (p: unknown) => void),
  onRemoved: (fn: (id: string) => void) => listen('tabRemoved', fn as (p: unknown) => void),
  onCreated: (fn: (tab: TabState) => void) => listen('tabCreated', fn as (p: unknown) => void),
  onState: (fn: (state: WindowState) => void) => listen('windowState', fn as (p: unknown) => void),
  onFindResult: (fn: (result: unknown) => void) => listen('findResult', fn),
};

export const search = {
  suggest: (query: string) => call<Suggestion[]>('searchSuggest', { query }),
  resolve: (input: string) => call<{ kind: string; url?: string; reason?: string }>('searchResolve', { input }),
  engines: () => call<SearchEngine[]>('searchEngines'),
};

export const bookmarks = {
  list: () => call<Bookmark[]>('bookmarksList'),
  add: (url: string, title: string, folder?: string) => call<Bookmark>('bookmarksAdd', { url, title, folder }),
  update: (id: string, patch: Partial<Bookmark>) => call<Bookmark>('bookmarksUpdate', { id, patch }),
  remove: (id: string) => call<boolean>('bookmarksRemove', { id }),
  move: (id: string, folder: string, position: number) => call<boolean>('bookmarksMove', { id, folder, position }),
  folders: () => call<string[]>('bookmarksFolders'),
  contains: (url: string) => call<boolean>('bookmarksContains', { url }),
  exportItems: () => call<Bookmark[]>('bookmarksExport'),
  importItems: (items: Bookmark[]) => call<number>('bookmarksImport', { items }),
};

export const history = {
  list: (since = 0, limit = 500) => call<HistoryEntry[]>('historyList', { since, limit }),
  search: (query: string) => call<HistoryEntry[]>('historySearch', { query }),
  remove: (ids: number[]) => call<number>('historyRemove', { ids }),
  clear: (since = 0) => call<number>('historyClear', { since }),
  recentlyClosed: () => call<{ url: string; title: string; closedAt: number }[]>('historyRecentlyClosed'),
};

export const topSites = {
  list: () => call<TopSite[]>('topSitesList'),
  pin: (host: string, pinned: boolean) => call<boolean>('topSitesPin', { host, pinned }),
  remove: (host: string) => call<boolean>('topSitesRemove', { host }),
};

export const downloads = {
  list: () => call<DownloadItem[]>('downloadsList'),
  pause: (id: string) => call<boolean>('downloadsPause', { id }),
  resume: (id: string) => call<boolean>('downloadsResume', { id }),
  cancel: (id: string) => call<boolean>('downloadsCancel', { id }),
  remove: (id: string) => call<boolean>('downloadsRemove', { id }),
  open: (id: string) => call<{ ok: boolean; error?: string }>('downloadsOpen', { id }),
  showInFolder: (id: string) => call<{ ok: boolean; error?: string }>('downloadsShow', { id }),
  retry: (id: string) => call<{ ok: boolean; error?: string }>('downloadsRetry', { id }),
  onUpdated: (fn: (item: DownloadItem) => void) => listen('downloadUpdated', fn as (p: unknown) => void),
};

export const settings = {
  get: () => call<SettingsData>('settingsGet'),
  update: (patch: Record<string, unknown>) => call<SettingsData>('settingsUpdate', { patch }),
  reset: () => call<SettingsData>('settingsReset'),
  hardware: () => call<HardwareInfo>('hardwareInfo'),
};

export const privacy = {
  status: (url: string) => call<AdblockStatus>('privacyStatus', { url }),
  setEnabled: (enabled: boolean) => call<AdblockStatus>('privacySetEnabled', { enabled }),
  filterLists: () => call<{ id: string; name: string; description: string; enabled: boolean; category: string }[]>('privacyFilterLists'),
  setFilterLists: (ids: string[]) => call<AdblockStatus>('privacySetFilterLists', { ids }),
  toggleSite: (url: string, exempt: boolean) => call<AdblockStatus>('privacyToggleSite', { url, exempt }),
  updateLists: () => call<unknown>('privacyUpdateLists'),
  clearData: (options: ClearDataOptions) => call<Record<string, unknown>>('privacyClearData', options),
  stats: () => call<PrivacyStats>('privacyStats'),
  onStats: (fn: (stats: PrivacyStats) => void) => listen('privacyStats', fn as (p: unknown) => void),
};

export const permissions = {
  list: () => call<PermissionOverride[]>('permissionsList'),
  set: (origin: string, permission: string, decision: 'allow' | 'deny') =>
    call<PermissionOverride>('permissionsSet', { origin, permission, decision }),
  clear: (origin?: string, permission?: string) => call<PermissionOverride[]>('permissionsClear', { origin, permission }),
  respond: (id: string, allow: boolean, remember: boolean) => tell('permissionsRespond', { id, allow, remember }),
  onRequest: (fn: (req: { id: string; origin: string; permission: string; detail?: string }) => void) =>
    listen('permissionRequested', fn as (p: unknown) => void),
};

export const credentials = {
  vaultAvailable: () => call<boolean>('credentialsVaultAvailable'),
  list: () => call<CredentialSummary[]>('credentialsList'),
  reveal: (id: string) => call<CredentialSecret>('credentialsReveal', { id }),
  save: (data: { origin: string; username: string; password: string; title?: string }) =>
    call<CredentialSummary>('credentialsSave', data),
  update: (id: string, patch: { username?: string; password?: string; title?: string }) =>
    call<CredentialSummary>('credentialsUpdate', { id, patch }),
  remove: (id: string) => call<boolean>('credentialsRemove', { id }),
  generate: (options?: Record<string, unknown>) => call<string>('credentialsGenerate', options),
};

export const autofill = {
  list: () => call<AutofillProfile[]>('autofillList'),
  save: (profile: Partial<AutofillProfile>) => call<AutofillProfile>('autofillSave', profile),
  remove: (id: string) => call<boolean>('autofillRemove', { id }),
};

export const extensions = {
  list: () => call<ExtensionInfo[]>('extensionsList'),
  install: () => call<ExtensionInfo | null>('extensionsInstall'),
  remove: (id: string) => call<boolean>('extensionsRemove', { id }),
  setEnabled: (id: string, enabled: boolean) => call<ExtensionInfo>('extensionsSetEnabled', { id, enabled }),
  setToolbar: (id: string, visible: boolean) => call<ExtensionInfo>('extensionsSetToolbar', { id, visible }),
};

export interface AiChatRequest {
  requestId: string;
  tabId?: string | null;
  history?: { role: string; content: string }[];
  userText?: string;
  selectionText?: string;
  includePage?: boolean;
}

export interface AiPageContext {
  url: string;
  title: string;
  text: string;
}

export const ai = {
  status: () => call<AiStatus>('aiStatus'),
  chat: (request: AiChatRequest) => call<string>('aiChat', request),
  cancel: () => tell('aiChatCancel'),
  models: () => call<{ catalog: AiModelInfo[]; installed: AiInstalledModel[] }>('aiModels'),
  downloadModel: (modelId: string) => call<AiDownloadResult>('aiDownloadModel', { modelId }),
  ensureRuntime: () => call<{ ready: boolean; path: string | null; dir: string; executable: string }>('aiEnsureRuntime'),
  pageText: (tabId?: string | null) => call<AiPageContext>('aiPageText', { tabId }),
  selectionText: (tabId?: string | null) => call<string>('aiSelectionText', { tabId }),
  onStream: (fn: (payload: { requestId: string; token: string; done: boolean }) => void) =>
    listen('aiStream', fn as (p: unknown) => void),
  onStatus: (fn: (status: AiStatus) => void) => listen('aiStatus', fn as (p: unknown) => void),
  onModelProgress: (fn: (progress: AiModelProgress) => void) =>
    listen('aiModelProgress', fn as (p: unknown) => void),
};

export const app = {
  info: () => call<AppInfo>('appInfo'),
  quit: () => tell('appQuit'),
};

export const diagnostics = {
  get: () => call<DiagnosticsInfo>('diagnosticsGet'),
};

export type PiFlexApi = typeof piflex;
