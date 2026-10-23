import { Pin, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { useBrowser } from '@/store/browser-store';
import { hostOf } from '@/lib/utils';
import type { TopSite } from '@shared/types';

function TopSiteTile({ site, onOpen }: { site: TopSite; onOpen: (url: string) => void }) {
  const letter = (hostOf(site.url) || '?').charAt(0).toUpperCase();
  // Favicons are rendered as letter tiles rather than fetched from a third
  // party, so opening a new tab never leaks the user's top sites off-device.
  return (
    <button
      type="button"
      onClick={() => onOpen(site.url)}
      className="group flex w-[88px] flex-col items-center gap-2 rounded-xl p-2 transition-colors hover:bg-white/10"
      title={site.url}
    >
      <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-lg font-medium text-white/90 backdrop-blur">
        <span>{letter}</span>
        {site.pinned ? (
          <Pin size={10} className="absolute right-0.5 top-0.5 text-accent" fill="currentColor" />
        ) : null}
      </span>
      <span className="w-full truncate text-center text-[12px] text-white/80">
        {site.title || hostOf(site.url)}
      </span>
    </button>
  );
}

export function TopSitesGrid() {
  const { topSites, refreshTopSites, createTab, settingsData } = useBrowser();

  useEffect(() => {
    void refreshTopSites();
  }, [refreshTopSites]);

  const defaults = ['duckduckgo.com', 'wikipedia.org', 'github.com', 'youtube.com', 'reddit.com', 'news.ycombinator.com'];
  const sites: TopSite[] =
    topSites.length > 0
      ? topSites.slice(0, 10)
      : defaults.map((host, i) => ({
          host,
          url: `https://${host}`,
          title: host,
          visits: 0,
          lastVisit: 0,
          index: i,
          pinned: false,
        }));

  void settingsData;

  return (
    <div className="flex flex-wrap justify-center gap-1">
      {sites.map((site) => (
        <TopSiteTile key={site.host} site={site} onOpen={(url) => void createTab(url)} />
      ))}
      <button
        type="button"
        onClick={() => void createTab('piflex://bookmarks')}
        className="flex w-[88px] flex-col items-center gap-2 rounded-xl p-2 transition-colors hover:bg-white/10"
        title="Add a shortcut"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-white/20 text-white/60">
          <Plus size={18} />
        </span>
        <span className="text-[12px] text-white/60">Add</span>
      </button>
    </div>
  );
}
