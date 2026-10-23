import { create } from 'zustand';
import type {
  AiStatus,
  Bookmark,
  DownloadItem,
  HistoryEntry,
  PrivacyStats,
  SettingsData,
  Suggestion,
  TabState,
  Theme,
  TopSite,
} from '@shared/types';
import { bookmarks, downloads, history, privacy, search, settings, tabs, topSites, win } from '@/lib/api';

type PanelId =
  | 'none'
  | 'bookmarks'
  | 'history'
  | 'downloads'
  | 'privacy'
  | 'passwords'
  | 'extensions'
  | 'settings'
  | 'ai'
  | 'about';

interface FindState {
  open: boolean;
  query: string;
  matches: number;
  activeMatch: number;
}

interface BrowserStore {
  // window / shell
  maximized: boolean;
  toolbarHeight: number;
  theme: Theme;

  // tabs
  tabs: TabState[];
  tabOrder: string[];
  activeTabId: string | null;

  // address bar
  addressValue: string;
  addressFocused: boolean;
  suggestions: Suggestion[];

  // overlay panel
  panel: PanelId;
  settingsCategory: string;

  // data
  settingsData: SettingsData | null;
  bookmarks: Bookmark[];
  historyEntries: HistoryEntry[];
  downloads: DownloadItem[];
  topSites: TopSite[];
  privacyStats: PrivacyStats;
  aiStatus: AiStatus | null;

  // find-in-page
  find: FindState;

  // actions
  init(): Promise<void>;
  setPanel(panel: PanelId): void;
  setSettingsCategory(category: string): void;
  setAddress(value: string, focused?: boolean): void;
  commitAddress(value?: string): Promise<void>;
  refreshSuggestions(query: string): Promise<void>;

  createTab(url?: string, isPrivate?: boolean): Promise<void>;
  closeTab(id: string): Promise<void>;
  activateTab(id: string): void;
  navigate(id: string, input: string): Promise<void>;
  duplicateTab(id: string): Promise<void>;
  closeOtherTabs(id: string): Promise<void>;
  togglePin(id: string): Promise<void>;
  toggleMute(id: string): Promise<void>;
  reorderTabs(order: string[]): void;

  reloadActive(): void;
  backActive(): void;
  forwardActive(): void;
  navigateHome(): void;

  toggleBookmark(url: string, title: string): Promise<void>;
  refreshBookmarks(): Promise<void>;
  refreshHistory(): Promise<void>;
  refreshDownloads(): Promise<void>;
  refreshTopSites(): Promise<void>;
  updateSettings(patch: Record<string, unknown>): Promise<void>;
  resetSettings(): Promise<void>;

  openFind(): void;
  closeFind(): void;
  setFindQuery(query: string): void;
  applyTheme(theme: Theme): void;
}

const EMPTY_STATS: PrivacyStats = {
  adsBlocked: 0,
  trackersBlocked: 0,
  httpsUpgrades: 0,
  since: Date.now(),
  filterLists: [],
};

function applyThemeToDocument(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme;
  document.documentElement.setAttribute('data-theme', resolved);
}

export const useBrowser = create<BrowserStore>((set, get) => ({
  maximized: false,
  toolbarHeight: 84,
  theme: 'dark',

  tabs: [],
  tabOrder: [],
  activeTabId: null,

  addressValue: '',
  addressFocused: false,
  suggestions: [],

  panel: 'none',
  settingsCategory: 'general',

  settingsData: null,
  bookmarks: [],
  historyEntries: [],
  downloads: [],
  topSites: [],
  privacyStats: EMPTY_STATS,
  aiStatus: null,

  find: { open: false, query: '', matches: 0, activeMatch: 0 },

  async init() {
    const winMax = await win.isMaximized().catch(() => false);
    set({ maximized: winMax });

    const stateTabs = await tabs.list().catch(() => []);
    const loaded = await settings.get().catch(() => null);
    const theme = ((loaded?.theme as Theme) || 'dark') as Theme;
    applyThemeToDocument(theme);
    set({
      tabs: stateTabs,
      tabOrder: stateTabs.map((t) => t.id),
      activeTabId: stateTabs.find((t) => !t.private)?.id ?? stateTabs[0]?.id ?? null,
      settingsData: loaded,
      theme,
    });

    await Promise.all([
      get().refreshBookmarks(),
      get().refreshHistory(),
      get().refreshDownloads(),
      get().refreshTopSites(),
    ]);

    tabs.onState((state) => {
      const active = state.activeTabId;
      const activeTab = active ? state.tabs[active] : null;
      set({
        activeTabId: active,
        tabOrder: state.tabOrder,
        tabs: state.tabOrder.map((id) => state.tabs[id]).filter(Boolean) as TabState[],
      });
      if (activeTab && !get().addressFocused) {
        set({ addressValue: activeTab.url.startsWith('piflex://') ? '' : activeTab.url });
      }
    });
    tabs.onUpdated((tab) => {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tab.id ? tab : t)),
      }));
      if (tab.id === get().activeTabId && !get().addressFocused) {
        set({ addressValue: tab.url.startsWith('piflex://') ? '' : tab.url });
      }
    });
    tabs.onCreated((tab) => {
      set((s) => ({
        tabs: s.tabs.some((t) => t.id === tab.id) ? s.tabs : [...s.tabs, tab],
        tabOrder: s.tabOrder.includes(tab.id) ? s.tabOrder : [...s.tabOrder, tab.id],
      }));
    });
    tabs.onRemoved((id) => {
      set((s) => ({
        tabs: s.tabs.filter((t) => t.id !== id),
        tabOrder: s.tabOrder.filter((t) => t !== id),
      }));
    });
    tabs.onFindResult((result) => {
      const r = result as { matches?: number; activeMatchOrdinal?: number };
      set((s) => ({
        find: { ...s.find, matches: r.matches ?? 0, activeMatch: r.activeMatchOrdinal ?? 0 },
      }));
    });
    downloads.onUpdated((item) => {
      set((s) => {
        const exists = s.downloads.some((d) => d.id === item.id);
        const next = exists
          ? s.downloads.map((d) => (d.id === item.id ? item : d))
          : [item, ...s.downloads];
        return { downloads: next };
      });
    });
    privacy.onStats((stats) => set({ privacyStats: stats }));
    win.onMaximized((value) => set({ maximized: value }));
  },

  setPanel(panel) {
    set({ panel });
  },
  setSettingsCategory(settingsCategory) {
    set({ settingsCategory });
  },

  setAddress(value, focused = true) {
    set({ addressValue: value, addressFocused: focused });
  },

  async refreshSuggestions(query) {
    if (!query.trim()) {
      set({ suggestions: [] });
      return;
    }
    const results = await search.suggest(query).catch(() => []);
    set({ suggestions: results });
  },

  async commitAddress(value) {
    const input = (value ?? get().addressValue).trim();
    if (!input) return;
    const id = get().activeTabId;
    if (!id) {
      await get().createTab(input);
      return;
    }
    await tabs.navigate(id, input).catch(() => undefined);
    set({ addressFocused: false, suggestions: [] });
  },

  async createTab(url, isPrivate = false) {
    const tab = await tabs.create(url, isPrivate).catch(() => null);
    if (tab) {
      set((s) => ({
        tabs: [...s.tabs, tab],
        tabOrder: [...s.tabOrder, tab.id],
        activeTabId: tab.id,
        addressValue: url && !url.startsWith('piflex://') ? url : '',
      }));
    }
  },

  async closeTab(id) {
    await tabs.close(id).catch(() => undefined);
  },

  activateTab(id) {
    tabs.activate(id);
    set({ activeTabId: id });
  },

  async navigate(id, input) {
    await tabs.navigate(id, input).catch(() => undefined);
  },

  async duplicateTab(id) {
    await tabs.duplicate(id).catch(() => undefined);
  },

  async closeOtherTabs(id) {
    await tabs.closeOthers(id).catch(() => undefined);
  },

  async togglePin(id) {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    await tabs.pin(id, !tab.pinned).catch(() => undefined);
  },

  async toggleMute(id) {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    await tabs.mute(id, !tab.muted).catch(() => undefined);
  },

  reorderTabs(order) {
    set({ tabOrder: order });
    void tabs.reorder(order);
  },

  reloadActive() {
    const id = get().activeTabId;
    if (id) void tabs.reload(id);
  },
  backActive() {
    const id = get().activeTabId;
    if (id) void tabs.back(id);
  },
  forwardActive() {
    const id = get().activeTabId;
    if (id) void tabs.forward(id);
  },
  navigateHome() {
    const id = get().activeTabId;
    if (id) void tabs.home(id);
  },

  async toggleBookmark(url, title) {
    const existing = get().bookmarks.find((b) => b.url === url);
    if (existing) {
      await bookmarks.remove(existing.id).catch(() => undefined);
    } else {
      await bookmarks.add(url, title).catch(() => undefined);
    }
    await get().refreshBookmarks();
  },

  async refreshBookmarks() {
    const list = await bookmarks.list().catch(() => []);
    set({ bookmarks: list });
  },
  async refreshHistory() {
    const list = await history.list().catch(() => []);
    set({ historyEntries: list });
  },
  async refreshDownloads() {
    const list = await downloads.list().catch(() => []);
    set({ downloads: list });
  },
  async refreshTopSites() {
    const list = await topSites.list().catch(() => []);
    set({ topSites: list });
  },

  async updateSettings(patch) {
    const next = await settings.update(patch).catch(() => null);
    if (next) {
      const theme = (next.theme as Theme) || get().theme;
      applyThemeToDocument(theme);
      set({ settingsData: next, theme });
    }
  },
  async resetSettings() {
    const next = await settings.reset().catch(() => null);
    if (next) {
      const theme = (next.theme as Theme) || 'dark';
      applyThemeToDocument(theme);
      set({ settingsData: next, theme });
    }
  },

  openFind() {
    set((s) => ({ find: { ...s.find, open: true } }));
  },
  closeFind() {
    const id = get().activeTabId;
    if (id) void tabs.findStop(id, 'clearSelection');
    set({ find: { open: false, query: '', matches: 0, activeMatch: 0 } });
  },
  setFindQuery(query) {
    const id = get().activeTabId;
    set((s) => ({ find: { ...s.find, query } }));
    if (id) void tabs.find(id, query);
  },

  applyTheme(theme) {
    applyThemeToDocument(theme);
    set({ theme });
  },
}));

export type { PanelId };
