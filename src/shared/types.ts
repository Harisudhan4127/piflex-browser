// Shared, serialisable types used across the main process, the preload bridge
// and the renderer. These descriptions are intentionally free of Node and DOM
// types so both sides can import them safely.

export type Theme = 'light' | 'dark' | 'system';

export type SecurityLevel =
  | 'secure'
  | 'insecure'
  | 'local'
  | 'internal'
  | 'unknown';

export interface SecurityState {
  level: SecurityLevel;
  label: string;
}

export interface SearchEngine {
  id: string;
  name: string;
  template: string;
  description: string;
  builtIn: boolean;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  folder: string;
  created: number;
  updated: number;
}

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  host: string;
  visitCount: number;
  lastVisit: number;
}

export interface TopSite {
  host: string;
  url: string;
  title: string;
  visits: number;
  lastVisit: number;
  index: number;
  pinned: boolean;
}

export type DownloadState =
  | 'progressing'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'interrupted';

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  savePath: string | null;
  mimeType: string;
  totalBytes: number;
  receivedBytes: number;
  state: DownloadState;
  startedAt: number;
  completedAt: number | null;
  canResume: boolean;
  danger: boolean;
  error?: string | null;
}

export interface CredentialSummary {
  id: string;
  origin: string;
  username: string;
  title: string;
  created: number;
  updated: number;
}

export interface CredentialSecret extends CredentialSummary {
  password: string;
}

export interface AutofillField {
  key: string;
  label: string;
  value: string;
  sensitive: boolean;
}

export interface AutofillProfile {
  id: string;
  name: string;
  category: 'identity' | 'address' | 'payment';
  fields: AutofillField[];
  updated: number;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  path: string;
  permissions: string[];
  hostPermissions: string[];
  toolbarVisible: boolean;
  error: string | null;
}

export interface PermissionRequest {
  id: string;
  origin: string;
  permission: string;
  detail?: string;
}

export interface PermissionOverride {
  origin: string;
  permission: string;
  decision: 'allow' | 'deny';
}

export interface TabState {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  audible: boolean;
  muted: boolean;
  private: boolean;
  pinned: boolean;
  groupId: string | null;
  security: SecurityState;
  crashed: boolean;
  suspended: boolean;
}

export interface TabGroup {
  id: string;
  name: string;
  color: string;
}

export interface WindowState {
  id: number;
  activeTabId: string | null;
  tabOrder: string[];
  tabs: Record<string, TabState>;
  groups: TabGroup[];
}

export interface PrivacyStats {
  adsBlocked: number;
  trackersBlocked: number;
  httpsUpgrades: number;
  since: number;
  filterLists: string[];
}

export interface AdblockStatus {
  enabled: boolean;
  filterLists: string[];
  rulesCount: number;
  lastUpdated: number;
  siteExempt: boolean;
}

export interface Suggestion {
  kind: 'search' | 'url' | 'bookmark' | 'history' | 'toptitle';
  title: string;
  url: string;
  detail?: string;
}

export interface SearchResultSet {
  suggestions: Suggestion[];
}

export interface HardwareInfo {
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCount: number;
  totalMemoryMB: number;
  recommendedDiskCacheMB: number;
  recommendedMaxTabs: number;
}

export interface ProcessMetricInfo {
  pid: number;
  type: string;
  name: string;
  memoryMB: number;
  cpuPercent: number;
}

export interface DiagnosticsSystemInfo {
  platform: string;
  arch: string;
  archFamily: string;
  osRelease: string;
  cpuModel: string;
  cpuCores: number;
  totalMB: number;
  freeMB: number;
  usedMB: number;
  pressure: number;
  isLowMemory: boolean;
  appVersion: string;
  versions: { electron: string; chrome: string; node: string; v8: string };
}

export interface DiagnosticsInfo {
  processes: ProcessMetricInfo[];
  appMemoryMB: number;
  mainHeapMB: number;
  system: DiagnosticsSystemInfo;
  tabs: {
    total: number;
    active: number;
    private: number;
    internal: number;
    suspended: number;
  };
  ai: AiStatus;
  adblock: AdblockStatus;
}

export interface AiStatus {
  enabled: boolean;
  provider: string;
  ready: boolean;
  modelId: string | null;
  installedModels: string[];
  runtimeReady?: boolean;
  provisioning?: boolean;
  message: string;
}

export interface AiModelInfo {
  id: string;
  name: string;
  paramsB: number;
  quant: string;
  approxSizeMB: number;
  contextDefault: number;
  contextMax: number;
  license: string;
  licenseUrl: string;
  source: string;
  url: string;
  description: string;
  recommendedFor: string;
}

export interface AiInstalledModel {
  path: string;
  file: string;
  sizeBytes: number;
}

export interface AiDownloadResult {
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface AiModelProgress {
  requestId?: string;
  modelId?: string;
  kind?: string;
  phase?: string;
  asset?: string;
  received: number;
  total: number;
  done: boolean;
  sha256?: string;
  path?: string;
}

export interface AiSettingsConfig {
  enabled: boolean;
  autoSetup: boolean;
  provider: 'llamacpp' | 'ollama' | 'openai-compatible';
  endpoint: string;
  modelId: string | null;
  modelPath: string | null;
  runtimePath: string | null;
  port: number;
  contextTokens: number;
  maxTokens: number;
  memoryBudgetMB: number;
  gpuLayers: 'auto' | number;
  autoUnloadMinutes: number;
  allowPageContext: boolean;
  temperature: number;
  threads: 'auto' | number;
}

export interface ClearDataOptions {
  history: boolean;
  downloads: boolean;
  cookies: boolean;
  cache: boolean;
  credentials: boolean;
  since?: number;
}

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chromium: string;
  node: string;
  platform: string;
}

// IPC result envelope. Every privileged operation resolves to this shape so the
// renderer never has to reason about thrown cross-process errors.
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface NewTabHomeConfig {
  showClock: boolean;
  showGreeting: boolean;
  showSearch: boolean;
  showTopSites: boolean;
  showPrivacyStats: boolean;
  showRecent: boolean;
  showNews: boolean;
  wallpapers: string[];
  activeWallpaper: string | null;
  widgetOrder: string[];
}

export type SettingsShape = Record<string, unknown>;

/** Loose but typed view over the settings tree persisted by the main process. */
export interface SettingsData {
  version: number;
  theme: Theme;
  search: {
    engineId: string;
    custom: { id: string; name: string; template: string; description: string; builtIn: boolean }[];
    localSuggestions: boolean;
    externalSuggestions: boolean;
  };
  startup: { restoreSession: boolean; openHomeOnStart: boolean };
  tabs: { suspendAfterMinutes: number; suspendOnMemoryPressure: boolean; maxTabs: number };
  privacy: {
    adblock: boolean;
    cosmeticFiltering: boolean;
    sendDoNotTrack: boolean;
    filterListIds: string[];
    clearDataOnExit: boolean;
    historyEnabled: boolean;
  };
  downloads: { directory: string | null };
  ai: AiSettingsConfig;
  extensions: { enabled: boolean };
  appearance: {
    backgroundImage: string | null;
    compactToolbar: boolean;
    showBookmarksBar: boolean;
    showHomeButton: boolean;
    toolbarOrder: string[];
  };
  newTab: NewTabHomeConfig;
  autofill: { enabled: boolean; savePasswords: boolean; saveAddresses: boolean; savePayments: boolean };
  accessibility: { reducedMotion: boolean; largerControls: boolean; highContrast: boolean };
  language: { ui: string; translationEnabled: boolean; preferredForTranslation: string[] };
  shortcuts: Record<string, string>;
  sync: { enabled: boolean; profile: string };
  advanced: {
    hardwareAcceleration: boolean;
    devTools: boolean;
    diskCacheMB: number;
    logLevel: string;
  };
  permissions: Record<string, unknown>;
  sites: { adblockExempt: string[]; permissionOverrides: Record<string, Record<string, string>> };
  [key: string]: unknown;
}
