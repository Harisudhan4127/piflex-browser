import { useEffect, useState } from 'react';
import * as React from 'react';
import {
  Settings as SettingsIcon,
  Palette,
  Search as SearchIcon,
  ShieldCheck,
  LayoutGrid,
  Download as DownloadIcon,
  KeyRound,
  Accessibility,
  Puzzle,
  SlidersHorizontal,
  RotateCcw,
  ExternalLink,
  Sparkles,
  Languages,
  MonitorCog,
  Rocket,
  Check,
  Loader2,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { InternalPageLayout } from '@/components/InternalPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SimpleSelect as Select } from '@/components/ui/select';
import { useBrowser } from '@/store/browser-store';
import { ai as aiApi, privacy, search as searchApi } from '@/lib/api';
import { WALLPAPERS } from '@/lib/wallpapers';
import { cn } from '@/lib/utils';
import type {
  AiInstalledModel,
  AiModelInfo,
  AiModelProgress,
  AiSettingsConfig,
  AiStatus,
  SearchEngine,
  Theme,
} from '@shared/types';

const CATEGORIES = [
  { id: 'getstarted', label: 'Get started', icon: <Rocket size={15} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { id: 'ai', label: 'AI', icon: <Sparkles size={15} /> },
  { id: 'autofill', label: 'Autofill and passwords', icon: <KeyRound size={15} /> },
  { id: 'languages', label: 'Languages', icon: <Languages size={15} /> },
  { id: 'search', label: 'Search engine', icon: <SearchIcon size={15} /> },
  { id: 'privacy', label: 'Privacy & security', icon: <ShieldCheck size={15} /> },
  { id: 'downloads', label: 'Downloads', icon: <DownloadIcon size={15} /> },
  { id: 'accessibility', label: 'Accessibility', icon: <Accessibility size={15} /> },
  { id: 'system', label: 'System', icon: <MonitorCog size={15} /> },
  { id: 'extensions', label: 'Extensions', icon: <Puzzle size={15} /> },
  { id: 'tabs', label: 'Tabs', icon: <LayoutGrid size={15} /> },
  { id: 'general', label: 'General', icon: <SettingsIcon size={15} /> },
  { id: 'advanced', label: 'Advanced', icon: <SlidersHorizontal size={15} /> },
  { id: 'reset', label: 'Reset settings', icon: <RotateCcw size={15} /> },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

export function SettingsPage() {
  const { settingsData, updateSettings, resetSettings, settingsCategory, setSettingsCategory } = useBrowser();
  const [engines, setEngines] = useState<SearchEngine[]>([]);
  const category = (CATEGORIES.find((c) => c.id === settingsCategory)?.id ?? 'general') as CategoryId;

  useEffect(() => {
    void searchApi.engines().then(setEngines).catch(() => undefined);
  }, []);

  const s = settingsData;
  const set = (patch: Record<string, unknown>) => void updateSettings(patch);

  if (!s) {
    return (
      <InternalPageLayout page="settings" title="Settings">
        <div className="py-20 text-center text-[13px] text-[var(--color-text-subtle)]">Loading settings…</div>
      </InternalPageLayout>
    );
  }

  return (
    <InternalPageLayout page="settings" title="Settings" subtitle="Changes save automatically" constrain={false}>
      <div className="flex h-full">
        <nav className="w-52 shrink-0 border-r border-[var(--color-border)] p-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSettingsCategory(c.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                c.id === category
                  ? 'bg-[var(--color-surface-overlay)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]/60 hover:text-[var(--color-text)]',
              )}
            >
              {c.icon}
              {c.label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-6">
            {category === 'getstarted' ? (
              <Section title="Get started with PiFlex">
                <p className="mb-4 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                  PiFlex keeps your browsing data on this device. Everything below saves automatically. The
                  assistant is optional and never sends page content anywhere unless you ask it to.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" size="sm" onClick={() => void useBrowser.getState().createTab('piflex://help')}>
                    <ExternalLink size={13} /> Open help
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void useBrowser.getState().createTab('piflex://diagnostics')}
                  >
                    <Activity size={13} /> Diagnostics
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSettingsCategory('search')}>
                    <SearchIcon size={13} /> Choose a search engine
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSettingsCategory('appearance')}>
                    <Palette size={13} /> Customize appearance
                  </Button>
                </div>
                <div className="mt-5 rounded-lg border border-[var(--color-border)] p-3 text-[12px] leading-relaxed text-[var(--color-text-subtle)]">
                  PiFlex does not set itself as the operating-system default browser automatically. Use your
                  system settings if you want PiFlex to open links from other apps.
                </div>
              </Section>
            ) : null}

            {category === 'general' ? (
              <Section title="General">
                <Row label="Theme" hint="Light, dark, or follow the system.">
                  <Select
                    value={s.theme}
                    onChange={(value) => set({ theme: value as Theme })}
                    options={[
                      { value: 'system', label: 'System' },
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                    ]}
                  />
                </Row>
                <Row label="Restore tabs on startup" hint="Reopen tabs from your previous session.">
                  <Switch
                    checked={s.startup.restoreSession}
                    onCheckedChange={(v) => set({ startup: { restoreSession: v } })}
                  />
                </Row>
                <Row label="Open home page on start" hint="Open the new-tab page as the first tab.">
                  <Switch
                    checked={s.startup.openHomeOnStart}
                    onCheckedChange={(v) => set({ startup: { openHomeOnStart: v } })}
                  />
                </Row>
              </Section>
            ) : null}

            {category === 'appearance' ? (
              <Section title="Appearance">
                <Row label="Compact toolbar" hint="Reduce toolbar height for more content space.">
                  <Switch
                    checked={s.appearance.compactToolbar}
                    onCheckedChange={(v) => set({ appearance: { compactToolbar: v } })}
                  />
                </Row>
                <Row label="Show bookmarks bar">
                  <Switch
                    checked={s.appearance.showBookmarksBar}
                    onCheckedChange={(v) => set({ appearance: { showBookmarksBar: v } })}
                  />
                </Row>
                <Row label="Show home button">
                  <Switch
                    checked={s.appearance.showHomeButton}
                    onCheckedChange={(v) => set({ appearance: { showHomeButton: v } })}
                  />
                </Row>
                <div className="border-b border-[var(--color-border)]/60 py-3">
                  <div className="text-[13px] text-[var(--color-text)]">New-tab background</div>
                  <div className="text-[11px] text-[var(--color-text-subtle)]">
                    Pick a built-in gradient or use your own image (PNG, JPEG, WebP or GIF, up to 4 MB).
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        set({
                          newTab: { activeWallpaper: null },
                          appearance: { backgroundImage: null },
                        })
                      }
                      className={cn(
                        'flex h-14 w-24 items-center justify-center rounded-md border-2 bg-[var(--color-surface-elevated)] text-[11px] text-[var(--color-text-muted)]',
                        !s.newTab.activeWallpaper && !s.appearance.backgroundImage
                          ? 'border-accent'
                          : 'border-transparent',
                      )}
                    >
                      Default
                    </button>
                    {WALLPAPERS.map((wallpaper) => {
                      const active =
                        s.newTab.activeWallpaper === wallpaper.value ||
                        s.appearance.backgroundImage === wallpaper.value;
                      return (
                        <button
                          key={wallpaper.id}
                          type="button"
                          title={wallpaper.name}
                          onClick={() => set({ newTab: { activeWallpaper: wallpaper.value } })}
                          className={cn(
                            'relative h-14 w-24 rounded-md border-2 transition-transform hover:scale-105',
                            active ? 'border-accent' : 'border-transparent',
                          )}
                          style={{ backgroundImage: wallpaper.value }}
                        >
                          {active ? (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                              <Check size={11} />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/png,image/jpeg,image/webp,image/gif';
                        input.onchange = () => {
                          const file = input.files?.[0];
                          if (!file) return;
                          if (file.size > 4 * 1024 * 1024) {
                            window.alert('Please choose an image smaller than 4 MB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            set({
                              newTab: { activeWallpaper: String(reader.result) },
                              appearance: { backgroundImage: null },
                            });
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      }}
                    >
                      Choose image
                    </Button>
                    {s.newTab.activeWallpaper && !s.newTab.activeWallpaper.startsWith('linear-gradient') ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => set({ newTab: { activeWallpaper: null } })}
                      >
                        Remove image
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void useBrowser.getState().createTab('piflex://newtab')}
                  >
                    <ExternalLink size={13} /> Preview new tab
                  </Button>
                </div>
              </Section>
            ) : null}

            {category === 'ai' ? <AiSettings config={s.ai} set={set} /> : null}

            {category === 'languages' ? (
              <Section title="Languages">
                <Row
                  label="Interface language"
                  hint="PiFlex currently ships English strings. Your choice is stored for translated builds."
                >
                  <Select
                    value={s.language.ui}
                    onChange={(value) => set({ language: { ui: value } })}
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'es', label: 'Español' },
                      { value: 'fr', label: 'Français' },
                      { value: 'de', label: 'Deutsch' },
                      { value: 'pt', label: 'Português' },
                      { value: 'hi', label: 'हिन्दी' },
                      { value: 'ar', label: 'العربية' },
                      { value: 'zh', label: '中文' },
                      { value: 'ja', label: '日本語' },
                    ]}
                  />
                </Row>
                <Row
                  label="Offer to translate pages"
                  hint="Reserved for a future built-in translator. No page text is sent anywhere today."
                >
                  <Switch
                    checked={s.language.translationEnabled}
                    onCheckedChange={(v) => set({ language: { translationEnabled: v } })}
                  />
                </Row>
                <div className="rounded-lg border border-[var(--color-border)] p-3 text-[12px] leading-relaxed text-[var(--color-text-subtle)]">
                  Page translation is not implemented yet. PiFlex will not send page content to a translation
                  service unless a future version adds an explicit, opt-in provider.
                </div>
              </Section>
            ) : null}

            {category === 'search' ? (
              <Section title="Search engine">
                <Row label="Default search engine">
                  <Select
                    value={s.search.engineId}
                    onChange={(value) => set({ search: { engineId: value } })}
                    options={engines.map((e) => ({ value: e.id, label: e.name }))}
                  />
                </Row>
                <Row label="Local suggestions" hint="Suggest from your own history and bookmarks.">
                  <Switch
                    checked={s.search.localSuggestions}
                    onCheckedChange={(v) => set({ search: { localSuggestions: v } })}
                  />
                </Row>
                <Row
                  label="External suggestions"
                  hint="Disabled for privacy — keystrokes are never sent to search providers."
                >
                  <Switch checked={false} disabled onCheckedChange={() => undefined} />
                </Row>
                {s.search.custom.length > 0 ? (
                  <div className="mt-3">
                    <div className="mb-1 text-[12px] font-medium text-[var(--color-text)]">Custom engines</div>
                    <ul className="space-y-1">
                      {s.search.custom.map((e) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-[12px]"
                        >
                          <span className="text-[var(--color-text)]">{e.name}</span>
                          <button
                            type="button"
                            className="text-[var(--color-danger)] hover:underline"
                            onClick={() =>
                              set({ search: { custom: s.search.custom.filter((c) => c.id !== e.id) } })
                            }
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <AddEngine
                  onAdd={(engine) => set({ search: { custom: [...s.search.custom, engine] } })}
                />
              </Section>
            ) : null}

            {category === 'privacy' ? (
              <Section title="Privacy & security">
                <Row label="Block ads & trackers" hint="Network-level filtering with community filter lists.">
                  <Switch checked={s.privacy.adblock} onCheckedChange={(v) => set({ privacy: { adblock: v } })} />
                </Row>
                <Row label="Cosmetic filtering" hint="Hide leftover ad placeholders on pages.">
                  <Switch
                    checked={s.privacy.cosmeticFiltering}
                    onCheckedChange={(v) => set({ privacy: { cosmeticFiltering: v } })}
                  />
                </Row>
                <Row label="Send Do Not Track" hint="Ask sites not to track you (honored voluntarily).">
                  <Switch
                    checked={s.privacy.sendDoNotTrack}
                    onCheckedChange={(v) => set({ privacy: { sendDoNotTrack: v } })}
                  />
                </Row>
                <Row label="Save browsing history">
                  <Switch
                    checked={s.privacy.historyEnabled}
                    onCheckedChange={(v) => set({ privacy: { historyEnabled: v } })}
                  />
                </Row>
                <Row label="Clear data on exit" hint="Erase cookies, cache and storage when you quit.">
                  <Switch
                    checked={s.privacy.clearDataOnExit}
                    onCheckedChange={(v) => set({ privacy: { clearDataOnExit: v } })}
                  />
                </Row>
                <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                  <ClearDataButton />
                </div>
              </Section>
            ) : null}

            {category === 'tabs' ? (
              <Section title="Tabs">
                <Row label="Suspend inactive tabs after" hint="Minutes of inactivity before a tab is put to sleep.">
                  <Input
                    type="number"
                    className="w-24"
                    value={String(s.tabs.suspendAfterMinutes)}
                    onChange={(e) =>
                      set({ tabs: { suspendAfterMinutes: Math.max(0, Number(e.target.value) || 0) } })
                    }
                  />
                </Row>
                <Row label="Suspend on memory pressure" hint="Automatically sleep tabs when memory runs low.">
                  <Switch
                    checked={s.tabs.suspendOnMemoryPressure}
                    onCheckedChange={(v) => set({ tabs: { suspendOnMemoryPressure: v } })}
                  />
                </Row>
                <Row label="Maximum open tabs" hint="Extra tabs beyond this are not prevented, only warned about.">
                  <Input
                    type="number"
                    className="w-24"
                    value={String(s.tabs.maxTabs)}
                    onChange={(e) => set({ tabs: { maxTabs: Math.max(1, Number(e.target.value) || 1) } })}
                  />
                </Row>
              </Section>
            ) : null}

            {category === 'downloads' ? (
              <Section title="Downloads">
                <Row label="Download folder" hint="Leave empty to use the system default.">
                  <Input
                    className="w-64"
                    value={s.downloads.directory ?? ''}
                    placeholder="System default"
                    onChange={(e) => set({ downloads: { directory: e.target.value.trim() || null } })}
                  />
                </Row>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void useBrowser.getState().createTab('piflex://downloads')}
                  >
                    <DownloadIcon size={13} /> View downloads
                  </Button>
                </div>
              </Section>
            ) : null}

            {category === 'autofill' ? (
              <Section title="Autofill and passwords">
                <Row label="Enable autofill">
                  <Switch checked={s.autofill.enabled} onCheckedChange={(v) => set({ autofill: { enabled: v } })} />
                </Row>
                <Row label="Offer to save passwords" hint="Encrypted with the OS keychain.">
                  <Switch
                    checked={s.autofill.savePasswords}
                    onCheckedChange={(v) => set({ autofill: { savePasswords: v } })}
                  />
                </Row>
                <Row label="Save addresses">
                  <Switch
                    checked={s.autofill.saveAddresses}
                    onCheckedChange={(v) => set({ autofill: { saveAddresses: v } })}
                  />
                </Row>
                <Row label="Save payment methods" hint="Stored encrypted; never used without your action.">
                  <Switch
                    checked={s.autofill.savePayments}
                    onCheckedChange={(v) => set({ autofill: { savePayments: v } })}
                  />
                </Row>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void useBrowser.getState().createTab('piflex://passwords')}
                  >
                    <KeyRound size={13} /> Open password manager
                  </Button>
                </div>
              </Section>
            ) : null}

            {category === 'accessibility' ? (
              <Section title="Accessibility">
                <Row label="Reduce motion" hint="Disable non-essential animation.">
                  <Switch
                    checked={s.accessibility.reducedMotion}
                    onCheckedChange={(v) => set({ accessibility: { reducedMotion: v } })}
                  />
                </Row>
                <Row label="Larger controls" hint="Increase the size of toolbars and buttons.">
                  <Switch
                    checked={s.accessibility.largerControls}
                    onCheckedChange={(v) => set({ accessibility: { largerControls: v } })}
                  />
                </Row>
                <Row label="High contrast" hint="Increase contrast between text and background.">
                  <Switch
                    checked={s.accessibility.highContrast}
                    onCheckedChange={(v) => set({ accessibility: { highContrast: v } })}
                  />
                </Row>
              </Section>
            ) : null}

            {category === 'system' ? (
              <Section title="System">
                <Row label="Hardware acceleration" hint="Use the GPU to render pages. Restart PiFlex to apply.">
                  <Switch
                    checked={s.advanced.hardwareAcceleration}
                    onCheckedChange={(v) => set({ advanced: { hardwareAcceleration: v } })}
                  />
                </Row>
                <Row label="Disk cache (MB)" hint="Capped automatically based on available memory.">
                  <Input
                    type="number"
                    className="w-24"
                    value={String(s.advanced.diskCacheMB)}
                    onChange={(e) => set({ advanced: { diskCacheMB: Math.max(0, Number(e.target.value) || 0) } })}
                  />
                </Row>
                <Row label="Log level" hint="More verbose logs help diagnose problems.">
                  <Select
                    value={s.advanced.logLevel}
                    onChange={(value) => set({ advanced: { logLevel: value } })}
                    options={[
                      { value: 'error', label: 'Error' },
                      { value: 'warn', label: 'Warning' },
                      { value: 'info', label: 'Info' },
                      { value: 'debug', label: 'Debug' },
                    ]}
                  />
                </Row>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void useBrowser.getState().createTab('piflex://diagnostics')}
                  >
                    <Activity size={13} /> Open diagnostics
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void useBrowser.getState().createTab('piflex://downloads')}
                  >
                    <DownloadIcon size={13} /> Downloads
                  </Button>
                </div>
              </Section>
            ) : null}

            {category === 'extensions' ? (
              <Section title="Extensions">
                <Row label="Enable extensions" hint="Allow loading unpacked extensions via Electron.">
                  <Switch
                    checked={s.extensions.enabled}
                    onCheckedChange={(v) => set({ extensions: { enabled: v } })}
                  />
                </Row>
                <p className="mt-3 text-[12px] text-[var(--color-text-subtle)]">
                  Manage installed extensions from the Extensions page.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void useBrowser.getState().createTab('piflex://extensions')}
                >
                  <ExternalLink size={13} /> Open Extensions
                </Button>
              </Section>
            ) : null}

            {category === 'advanced' ? (
              <Section title="Advanced">
                <Row label="Enable developer tools" hint="Allow the page context menu to open DevTools. Restart to apply.">
                  <Switch
                    checked={s.advanced.devTools}
                    onCheckedChange={(v) => set({ advanced: { devTools: v } })}
                  />
                </Row>
                <div className="mt-4 border-t border-[var(--color-border)] pt-4 text-[12px] text-[var(--color-text-subtle)]">
                  <div className="mb-1 font-medium text-[var(--color-text)]">About sync</div>
                  Profile sync is not available. PiFlex keeps everything on your device and does not operate a
                  sync service.
                </div>
              </Section>
            ) : null}

            {category === 'reset' ? <ResetSettings onReset={() => void resetSettings()} /> : null}
          </div>
        </div>
      </div>
    </InternalPageLayout>
  );
}

function modelFileName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  } catch {
    return '';
  }
}

function AiSettings({
  config,
  set,
}: {
  config: AiSettingsConfig;
  set: (patch: Record<string, unknown>) => void;
}) {
  const [catalog, setCatalog] = useState<AiModelInfo[]>([]);
  const [installed, setInstalled] = useState<AiInstalledModel[]>([]);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [progress, setProgress] = useState<AiModelProgress | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const models = await aiApi.models().catch(() => null);
    if (models) {
      setCatalog(models.catalog);
      setInstalled(models.installed);
      if (Array.isArray(models.ollamaModels)) setOllamaModels(models.ollamaModels);
    }
    const nextStatus = await aiApi.status().catch(() => null);
    if (nextStatus) setStatus(nextStatus);
  };

  useEffect(() => {
    void refresh();
    const offProgress = aiApi.onModelProgress((payload) => {
      setProgress(payload);
      if (payload.done) {
        setBusy(null);
        void refresh();
      }
    });
    const offStatus = aiApi.onStatus((next) => setStatus(next));
    return () => {
      offProgress();
      offStatus();
    };
  }, []);

  const downloadModel = async (model: AiModelInfo) => {
    setBusy(`model:${model.id}`);
    setError(null);
    setProgress(null);
    try {
      const result = await aiApi.downloadModel(model.id);
      set({ ai: { modelId: model.id, modelPath: result.path } });
      await refresh();
    } catch (err) {
      setError((err as Error).message || 'Model download failed');
    } finally {
      setBusy(null);
    }
  };

  const setupRuntime = async () => {
    setBusy('runtime');
    setError(null);
    setProgress(null);
    try {
      await aiApi.ensureRuntime();
      await refresh();
    } catch (err) {
      setError((err as Error).message || 'Runtime setup failed');
    } finally {
      setBusy(null);
    }
  };

  const isLocal = config.provider === 'llamacpp';
  const percent = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.received / progress.total) * 100))
    : 0;
  const activeModelFile = config.modelPath ? config.modelPath.split(/[\\/]/).pop() : null;

  return (
    <Section title="PiFlex Assistant">
      <Row label="Enable AI assistant" hint="Optional. Everything runs on this device by default.">
        <Switch checked={config.enabled} onCheckedChange={(v) => set({ ai: { enabled: v } })} />
      </Row>
      <Row
        label="Set up automatically"
        hint="Download the local runtime and a small model in the background on first use."
      >
        <Switch checked={config.autoSetup} onCheckedChange={(v) => set({ ai: { autoSetup: v } })} />
      </Row>
      <Row label="Provider" hint="Ollama uses your local Ollama daemon; llama.cpp is managed directly by PiFlex.">
        <Select
          value={config.provider}
          onChange={(value) => set({ ai: { provider: value } })}
          options={[
            { value: 'ollama', label: 'Ollama (default)' },
            { value: 'llamacpp', label: 'llama.cpp (local)' },
            { value: 'openai-compatible', label: 'OpenAI-compatible' },
          ]}
        />
      </Row>
      <Row
        label="Allow page context"
        hint="When off, the assistant cannot read the current page or selection."
      >
        <Switch
          checked={config.allowPageContext}
          onCheckedChange={(v) => set({ ai: { allowPageContext: v } })}
        />
      </Row>

      {isLocal ? (
        <>
          <div className="my-4 rounded-lg border border-[var(--color-border)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] text-[var(--color-text)]">Local runtime (llama-server)</div>
                <div className="text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
                  {status?.runtimeReady
                    ? 'The llama.cpp server is installed and ready.'
                    : 'PiFlex downloads the official llama.cpp build automatically on first use.'}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => void setupRuntime()} disabled={busy === 'runtime'}>
                {busy === 'runtime' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Set up runtime
              </Button>
            </div>
            {busy === 'runtime' && progress ? (
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-[var(--color-text-subtle)]">
                  {progress.phase === 'extracting' ? 'Extracting…' : `Downloading ${percent}%`}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mb-2 text-[12px] font-medium text-[var(--color-text)]">Models</div>
          <div className="space-y-2">
            {catalog.map((model) => {
              const file = modelFileName(model.url);
              const isInstalled = installed.some((item) => item.file === file);
              const isActive = !!activeModelFile && activeModelFile === file;
              const downloading = busy === `model:${model.id}`;
              return (
                <div
                  key={model.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[var(--color-text)]">{model.name}</div>
                    <div className="text-[11px] text-[var(--color-text-subtle)]">
                      {model.paramsB}B · {model.quant} · ~{model.approxSizeMB} MB · {model.license}
                    </div>
                    {downloading && progress ? (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
                        <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant={isActive ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={isActive}
                      onClick={() =>
                        isInstalled
                          ? set({ ai: { modelId: model.id, modelPath: installed.find((i) => i.file === file)?.path } })
                          : void downloadModel(model)
                      }
                    >
                      {isActive ? <Check size={12} /> : null}
                      {isInstalled ? (isActive ? 'Active' : 'Use') : downloading ? 'Downloading…' : 'Download'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {installed.length > 0 ? (
            <div className="mt-4">
              <div className="mb-2 text-[12px] font-medium text-[var(--color-text)]">Installed models</div>
              <ul className="space-y-1">
                {installed.map((model) => (
                  <li
                    key={model.path}
                    className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-[12px]"
                  >
                    <span className="truncate text-[var(--color-text-muted)]">{model.file}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => set({ ai: { modelPath: model.path, modelId: null } })}
                    >
                      Use this model
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : config.provider === 'ollama' ? (
        <>
          <Row label="Endpoint" hint="Default is http://127.0.0.1:11434.">
            <Input
              className="w-72"
              value={config.endpoint}
              onChange={(e) => set({ ai: { endpoint: e.target.value.trim() } })}
            />
          </Row>
          <Row label="Model name" hint="Model name installed in Ollama (defaults to llama3.2).">
            <div className="flex flex-col gap-2">
              <Input
                className="w-72"
                placeholder={ollamaModels[0] || 'llama3.2'}
                value={config.modelId || ''}
                onChange={(e) => set({ ai: { modelId: e.target.value.trim() || null } })}
              />
              {ollamaModels.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-subtle)]">
                  <span>Detected in Ollama:</span>
                  {ollamaModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set({ ai: { modelId: m } })}
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-[11px] transition-colors',
                        config.modelId === m
                          ? 'border-accent bg-accent/10 text-accent font-medium'
                          : 'border-[var(--color-border)] hover:bg-[var(--color-surface-overlay)] text-[var(--color-text)]',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Row>
        </>
      ) : (
        <>
          <Row label="Endpoint" hint="For example https://api.openai.com or local endpoint.">
            <Input
              className="w-72"
              value={config.endpoint}
              onChange={(e) => set({ ai: { endpoint: e.target.value.trim() } })}
            />
          </Row>
          <Row label="Model name" hint="For example gpt-4o-mini">
            <Input
              className="w-72"
              placeholder="gpt-4o-mini"
              value={config.modelId || ''}
              onChange={(e) => set({ ai: { modelId: e.target.value.trim() || null } })}
            />
          </Row>
          <Row label="API key" hint="Optional for local endpoints, required for cloud services.">
            <Input
              type="password"
              className="w-72"
              placeholder="sk-..."
              value={config.apiKey || ''}
              onChange={(e) => set({ ai: { apiKey: e.target.value.trim() } })}
            />
          </Row>
        </>
      )}

      <Row label="Temperature" hint="Lower is more focused; higher is more creative.">
        <Input
          type="number"
          step="0.1"
          min="0"
          max="2"
          className="w-24"
          value={String(config.temperature)}
          onChange={(e) => set({ ai: { temperature: Number(e.target.value) || 0 } })}
        />
      </Row>
      <Row label="Context tokens" hint="How much conversation and page text the model can consider.">
        <Input
          type="number"
          className="w-24"
          value={String(config.contextTokens)}
          onChange={(e) => set({ ai: { contextTokens: Number(e.target.value) || 0 } })}
        />
      </Row>
      <Row label="Max response tokens">
        <Input
          type="number"
          className="w-24"
          value={String(config.maxTokens)}
          onChange={(e) => set({ ai: { maxTokens: Number(e.target.value) || 0 } })}
        />
      </Row>
      <Row label="Local server port" hint="Used only by the managed llama.cpp runtime.">
        <Input
          type="number"
          className="w-24"
          value={String(config.port)}
          onChange={(e) => set({ ai: { port: Number(e.target.value) || 18080 } })}
        />
      </Row>

      {error ? (
        <div className="mt-3 rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-[12px] text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}
      <div className="mt-4 rounded-lg border border-[var(--color-border)] p-3 text-[12px] leading-relaxed text-[var(--color-text-subtle)]">
        Page text is untrusted and is redacted before it reaches a model. PiFlex never sends page content to a
        provider unless you include it in a request and page context is enabled. Local models stay on disk in
        your PiFlex data folder.
      </div>
    </Section>
  );
}

function ResetSettings({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Section title="Reset settings">
      <p className="mb-4 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
        Restore every option on this page to its default. Bookmarks, history, passwords and downloaded models
        are not deleted.
      </p>
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onReset();
              setConfirming(false);
            }}
          >
            <RotateCcw size={13} /> Yes, reset all settings
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          <RotateCcw size={13} /> Reset all settings
        </Button>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-[15px] font-semibold text-[var(--color-text)]">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)]/60 py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] text-[var(--color-text)]">{label}</div>
        {hint ? <div className="text-[11px] text-[var(--color-text-subtle)]">{hint}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function AddEngine({ onAdd }: { onAdd: (engine: { id: string; name: string; template: string; description: string; builtIn: boolean }) => void }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!name.trim() || !/^https:\/\/.+\{query\}/.test(template.trim())) {
      setError('Template must be an https:// URL containing {query}.');
      return;
    }
    onAdd({
      id: `custom-${Date.now().toString(36)}`,
      name: name.trim(),
      template: template.trim(),
      description: 'Custom engine',
      builtIn: false,
    });
    setName('');
    setTemplate('');
    setError(null);
  };

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <div className="mb-2 text-[12px] font-medium text-[var(--color-text)]">Add a search engine</div>
      <div className="flex flex-wrap gap-2">
        <Input className="w-32" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          className="flex-1"
          placeholder="https://example.com/search?q={query}"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        />
        <Button variant="secondary" size="sm" onClick={add}>
          Add
        </Button>
      </div>
      {error ? <div className="mt-1.5 text-[11px] text-[var(--color-danger)]">{error}</div> : null}
    </div>
  );
}

function ClearDataButton() {
  const [open, setOpen] = useState(false);
  const { updateSettings } = useBrowser();

  const clear = async (options: Partial<Record<'history' | 'downloads' | 'cookies' | 'cache' | 'credentials', boolean>>) => {
    await privacy
      .clearData({
        history: false,
        downloads: false,
        cookies: false,
        cache: false,
        credentials: false,
        ...options,
      })
      .catch(() => undefined);
    void updateSettings({});
    setOpen(false);
  };

  return (
    <div>
      <div className="text-[13px] text-[var(--color-text)]">Clear browsing data</div>
      <div className="mb-2 text-[11px] text-[var(--color-text-subtle)]">
        Remove history, cookies, cache, downloads and saved passwords.
      </div>
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Clear data…
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => void clear({ cache: true })}>
            Cache only
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void clear({ cookies: true, cache: true })}>
            Cookies &amp; cache
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() =>
              void clear({
                history: true,
                downloads: true,
                cookies: true,
                cache: true,
                credentials: true,
              })
            }
          >
            Everything
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
