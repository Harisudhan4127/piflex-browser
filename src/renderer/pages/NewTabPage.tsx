import { useMemo } from 'react';
import { Settings2, Shield } from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { ClockWidget, greeting } from '@/components/newtab/ClockWidget';
import { SearchWidget } from '@/components/newtab/SearchWidget';
import { TopSitesGrid } from '@/components/newtab/TopSitesGrid';
import { PrivacyStatsWidget } from '@/components/newtab/PrivacyStatsWidget';
import { RecentWidget } from '@/components/newtab/RecentWidget';
import { NewsFeed } from '@/components/newtab/NewsFeed';
import { DEFAULT_WALLPAPER } from '@/lib/wallpapers';

export function NewTabPage() {
  const { settingsData, setPanel, setSettingsCategory, tabs, activeTabId } = useBrowser();
  const config = settingsData?.newTab;
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const isPrivate = !!activeTab?.private;

  const background = useMemo(() => {
    // Newer builds store the choice on `newTab.activeWallpaper`; fall back to
    // the legacy appearance key so existing settings keep working.
    const wallpaper = config?.activeWallpaper ?? settingsData?.appearance.backgroundImage ?? null;
    if (wallpaper && wallpaper.startsWith('data:image/')) {
      return { backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    if (wallpaper && wallpaper.startsWith('linear-gradient')) {
      return { backgroundImage: wallpaper };
    }
    return { backgroundImage: DEFAULT_WALLPAPER };
  }, [config?.activeWallpaper, settingsData?.appearance.backgroundImage]);

  const widgetOrder = config?.widgetOrder ?? ['clock', 'search', 'topSites', 'privacyStats', 'recent', 'news'];

  const widgets: Record<string, React.ReactNode> = {
    clock: config?.showClock !== false ? <ClockWidget key="clock" /> : null,
    greeting:
      config?.showGreeting !== false ? (
        <div key="greeting" className="text-lg font-medium text-white/80">
          {greeting()}
        </div>
      ) : null,
    search: config?.showSearch !== false ? <SearchWidget key="search" /> : null,
    topSites: !isPrivate && config?.showTopSites !== false ? <TopSitesGrid key="topSites" /> : null,
    privacyStats: config?.showPrivacyStats !== false ? <PrivacyStatsWidget key="privacyStats" /> : null,
    recent: !isPrivate && config?.showRecent !== false ? <RecentWidget key="recent" /> : null,
    news: config?.showNews ? <NewsFeed key="news" /> : null,
  };

  const ordered = widgetOrder
    .map((id) => widgets[id])
    .filter((node): node is React.ReactNode => Boolean(node));

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto bg-[var(--color-surface)] p-8"
      style={background}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(0,0,0,0.15), rgba(0,0,0,0.55))' }}
      />
      {isPrivate ? (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur">
          <Shield size={12} className="text-accent" />
          Private window
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setSettingsCategory('appearance');
          setPanel('settings');
        }}
        className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur transition-colors hover:bg-black/50 hover:text-white"
        aria-label="Customize new tab"
        title="Customize this page"
      >
        <Settings2 size={16} />
      </button>
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6">
        {ordered}
      </div>
    </div>
  );
}
