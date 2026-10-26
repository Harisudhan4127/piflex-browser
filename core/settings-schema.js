'use strict';

const { normalizeCustomEngines } = require('./search');

const SETTINGS_VERSION = 2;

const FILTER_LIST_IDS = ['easylist', 'easyprivacy', 'ublock-filters', 'ublock-privacy'];

const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_VERSION,
  theme: 'system',
  search: {
    engineId: 'duckduckgo',
    custom: [],
    localSuggestions: true,
    externalSuggestions: false,
  },
  startup: {
    restoreSession: true,
    openHomeOnStart: false,
  },
  tabs: {
    suspendAfterMinutes: 30,
    suspendOnMemoryPressure: true,
    maxTabs: 30,
  },
  privacy: {
    adblock: true,
    cosmeticFiltering: true,
    sendDoNotTrack: true,
    filterListIds: ['easylist', 'easyprivacy'],
    clearDataOnExit: false,
    historyEnabled: true,
  },
  downloads: {
    directory: null,
  },
  ai: {
    enabled: true,
    autoSetup: true,
    provider: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    apiKey: '',
    modelId: null,
    modelPath: null,
    runtimePath: null,
    port: 18080,
    contextTokens: 2048,
    maxTokens: 512,
    memoryBudgetMB: 2048,
    gpuLayers: 'auto',
    autoUnloadMinutes: 10,
    allowPageContext: true,
    temperature: 0.7,
    threads: 'auto',
  },
  extensions: {
    enabled: false,
  },
  appearance: {
    backgroundImage: null,
    compactToolbar: false,
    showBookmarksBar: true,
    showHomeButton: true,
    toolbarOrder: ['privacy', 'extensions', 'downloads', 'profile'],
  },
  newTab: {
    showClock: true,
    showGreeting: true,
    showSearch: true,
    showTopSites: true,
    showPrivacyStats: true,
    showRecent: true,
    showNews: false,
    activeWallpaper: null,
    wallpapers: [],
    widgetOrder: ['clock', 'search', 'topSites', 'privacyStats', 'recent', 'news'],
  },
  autofill: {
    enabled: true,
    savePasswords: true,
    saveAddresses: true,
    savePayments: false,
  },
  accessibility: {
    reducedMotion: false,
    largerControls: false,
    highContrast: false,
  },
  language: {
    ui: 'en',
    translationEnabled: false,
    preferredForTranslation: [],
  },
  shortcuts: {},
  sync: {
    enabled: false,
    profile: 'default',
  },
  advanced: {
    hardwareAcceleration: true,
    devTools: false,
    diskCacheMB: 256,
    logLevel: 'warn',
  },
  permissions: {},
  sites: {
    adblockExempt: [],
    permissionOverrides: {},
  },
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function sanitizeStringList(value, maxItems, maxLength, pattern) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value) {
    const text = String(item || '').trim();
    if (!text || text.length > maxLength || seen.has(text)) continue;
    if (pattern && !pattern.test(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Deep-merge only keys known to the schema. Unknown keys are discarded, so a
 * tampered settings file cannot pollute prototypes or inject arbitrary config.
 */
function mergeKnown(target, source) {
  if (!isPlainObject(source)) return target;
  const out = clone(target);
  for (const key of Object.keys(out)) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const current = out[key];
    const incoming = source[key];
    if (isPlainObject(current)) {
      // Dynamic maps (permission overrides keyed by origin) may contain keys
      // that are not present in the default object.
      out[key] = key === 'permissionOverrides' && isPlainObject(incoming)
        ? clone(incoming)
        : mergeKnown(current, incoming);
    } else if (Array.isArray(current)) {
      out[key] = Array.isArray(incoming) ? incoming.slice() : current;
    } else if (incoming !== undefined) {
      out[key] = incoming;
    }
  }
  return out;
}

function normalizeSettings(raw) {
  const merged = mergeKnown(DEFAULT_SETTINGS, raw);
  const custom = normalizeCustomEngines(merged.search.custom);
  const allowedLists = new Set(FILTER_LIST_IDS);
  const hasExplicitFilterLists = isPlainObject(raw) && isPlainObject(raw.privacy) && Array.isArray(raw.privacy.filterListIds);
  const filterListIds = sanitizeStringList(
    merged.privacy.filterListIds,
    FILTER_LIST_IDS.length,
    40,
    /^[a-z0-9-]+$/,
  ).filter((id) => allowedLists.has(id));
  const exempt = sanitizeStringList(
    merged.sites.adblockExempt,
    500,
    253,
    /^[a-z0-9.*-]+$/i,
  );
  const permissions = {};
  if (isPlainObject(merged.sites.permissionOverrides)) {
    for (const [origin, decision] of Object.entries(merged.sites.permissionOverrides)) {
      if (!/^https?:\/\/[a-z0-9.:[\]-]+$/i.test(origin)) continue;
      if (!isPlainObject(decision)) continue;
      const cleaned = {};
      for (const [name, value] of Object.entries(decision)) {
        if (/^[a-z-]{2,40}$/.test(name) && (value === 'allow' || value === 'deny')) {
          cleaned[name] = value;
        }
      }
      if (Object.keys(cleaned).length) permissions[origin] = cleaned;
    }
  }

  const settings = {
    version: SETTINGS_VERSION,
    theme: oneOf(merged.theme, ['light', 'dark', 'system'], 'system'),
    search: {
      engineId: String(merged.search.engineId || 'duckduckgo').slice(0, 48),
      custom,
      localSuggestions: !!merged.search.localSuggestions,
      externalSuggestions: false,
    },
    startup: {
      restoreSession: !!merged.startup.restoreSession,
      openHomeOnStart: !!merged.startup.openHomeOnStart,
    },
    tabs: {
      suspendAfterMinutes: clampNumber(merged.tabs.suspendAfterMinutes, 0, 1440, 30),
      suspendOnMemoryPressure: !!merged.tabs.suspendOnMemoryPressure,
      maxTabs: clampNumber(merged.tabs.maxTabs, 1, 100, 30),
    },
    privacy: {
      adblock: !!merged.privacy.adblock,
      cosmeticFiltering: !!merged.privacy.cosmeticFiltering,
      sendDoNotTrack: !!merged.privacy.sendDoNotTrack,
      filterListIds: hasExplicitFilterLists ? filterListIds : (filterListIds.length ? filterListIds : ['easylist', 'easyprivacy']),
      clearDataOnExit: !!merged.privacy.clearDataOnExit,
      historyEnabled: !!merged.privacy.historyEnabled,
    },
    downloads: {
      directory: typeof merged.downloads.directory === 'string' && merged.downloads.directory.trim()
        ? merged.downloads.directory.trim().slice(0, 1024)
        : null,
    },
    ai: {
      enabled: merged.ai.enabled !== false,
      autoSetup: merged.ai.autoSetup !== false,
      provider: oneOf(merged.ai.provider, ['ollama', 'llamacpp', 'openai-compatible'], 'ollama'),
      endpoint: String(merged.ai.endpoint || 'http://127.0.0.1:11434').slice(0, 512),
      apiKey: merged.ai.apiKey ? String(merged.ai.apiKey).slice(0, 512) : '',
      modelId: merged.ai.modelId ? String(merged.ai.modelId).slice(0, 128) : null,
      modelPath: merged.ai.modelPath ? String(merged.ai.modelPath).slice(0, 1024) : null,
      runtimePath: merged.ai.runtimePath ? String(merged.ai.runtimePath).slice(0, 1024) : null,
      port: clampNumber(merged.ai.port, 1024, 65535, 18080),
      contextTokens: clampNumber(merged.ai.contextTokens, 512, 32768, 2048),
      maxTokens: clampNumber(merged.ai.maxTokens, 32, 4096, 512),
      memoryBudgetMB: clampNumber(merged.ai.memoryBudgetMB, 256, 262144, 2048),
      gpuLayers: merged.ai.gpuLayers === 'auto' ? 'auto' : clampNumber(merged.ai.gpuLayers, 0, 200, 0),
      autoUnloadMinutes: clampNumber(merged.ai.autoUnloadMinutes, 0, 240, 10),
      allowPageContext: !!merged.ai.allowPageContext,
      temperature: Math.min(2, Math.max(0, Number(merged.ai.temperature) || 0.7)),
      threads: merged.ai.threads === 'auto' ? 'auto' : clampNumber(merged.ai.threads, 1, 128, 1),
    },
    extensions: {
      enabled: !!merged.extensions.enabled,
    },
    appearance: {
      backgroundImage:
        typeof merged.appearance.backgroundImage === 'string' &&
        /^data:image\/(png|jpeg|webp|gif);base64,/i.test(merged.appearance.backgroundImage) &&
        merged.appearance.backgroundImage.length <= 4 * 1024 * 1024
          ? merged.appearance.backgroundImage
          : null,
      compactToolbar: !!merged.appearance.compactToolbar,
      showBookmarksBar: !!merged.appearance.showBookmarksBar,
      showHomeButton: !!merged.appearance.showHomeButton,
      toolbarOrder: sanitizeStringList(
        merged.appearance.toolbarOrder,
        8,
        24,
        /^[a-z]+$/,
      ),
    },
    newTab: {
      showClock: !!merged.newTab.showClock,
      showGreeting: !!merged.newTab.showGreeting,
      showSearch: !!merged.newTab.showSearch,
      showTopSites: !!merged.newTab.showTopSites,
      showPrivacyStats: !!merged.newTab.showPrivacyStats,
      showRecent: !!merged.newTab.showRecent,
      showNews: !!merged.newTab.showNews,
      activeWallpaper:
        typeof merged.newTab.activeWallpaper === 'string' &&
        merged.newTab.activeWallpaper.length <= 4 * 1024 * 1024 &&
        (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(merged.newTab.activeWallpaper) ||
          /^linear-gradient\(/i.test(merged.newTab.activeWallpaper))
          ? merged.newTab.activeWallpaper
          : null,
      wallpapers: sanitizeStringList(
        merged.newTab.wallpapers,
        8,
        4 * 1024 * 1024,
        /^(data:image\/(png|jpeg|webp|gif);base64,|linear-gradient\()/i,
      ),
      widgetOrder: sanitizeStringList(
        merged.newTab.widgetOrder,
        10,
        24,
        /^[a-zA-Z]+$/,
      ),
    },
    autofill: {
      enabled: !!merged.autofill.enabled,
      savePasswords: !!merged.autofill.savePasswords,
      saveAddresses: !!merged.autofill.saveAddresses,
      savePayments: !!merged.autofill.savePayments,
    },
    accessibility: {
      reducedMotion: !!merged.accessibility.reducedMotion,
      largerControls: !!merged.accessibility.largerControls,
      highContrast: !!merged.accessibility.highContrast,
    },
    language: {
      ui: String(merged.language.ui || 'en').slice(0, 12),
      translationEnabled: !!merged.language.translationEnabled,
      preferredForTranslation: sanitizeStringList(
        merged.language.preferredForTranslation,
        20,
        12,
        /^[a-zA-Z-]+$/,
      ),
    },
    shortcuts: isPlainObject(merged.shortcuts) ? clone(merged.shortcuts) : {},
    sync: {
      enabled: false,
      profile: String(merged.sync.profile || 'default').slice(0, 40),
    },
    advanced: {
      hardwareAcceleration: !!merged.advanced.hardwareAcceleration,
      devTools: !!merged.advanced.devTools,
      diskCacheMB: clampNumber(merged.advanced.diskCacheMB, 32, 4096, 256),
      logLevel: oneOf(merged.advanced.logLevel, ['error', 'warn', 'info', 'debug'], 'warn'),
    },
    permissions: {},
    sites: {
      adblockExempt: exempt,
      permissionOverrides: permissions,
    },
  };

  if (!settings.search.engineId) settings.search.engineId = 'duckduckgo';
  return settings;
}

module.exports = {
  DEFAULT_SETTINGS,
  FILTER_LIST_IDS,
  SETTINGS_VERSION,
  mergeKnown,
  normalizeSettings,
};
