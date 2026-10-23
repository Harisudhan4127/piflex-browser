import { Rss, Plus } from 'lucide-react';
import { useBrowser } from '@/store/browser-store';

/**
 * Optional RSS/news widget. Feed fetching requires a network request proxied
 * through the main process; until a feed URL is configured and fetching is
 * enabled this shows an honest empty state rather than fabricated headlines.
 */
export function NewsFeed() {
  const { settingsData } = useBrowser();
  const feeds = (settingsData?.newTab as { feeds?: string[] } | undefined)?.feeds ?? [];

  if (feeds.length === 0) {
    return (
      <div className="flex w-full max-w-2xl flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center backdrop-blur">
        <Rss size={20} className="text-white/50" />
        <div className="text-[13px] text-white/70">Add an RSS or Atom feed to see headlines here.</div>
        <button
          type="button"
          onClick={() => useBrowser.getState().setPanel('settings')}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-[12px] text-white/80 transition-colors hover:bg-white/20"
        >
          <Plus size={13} />
          Add a feed
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-[12px] uppercase tracking-wide text-white/60">
        <Rss size={14} />
        News
      </div>
      <div className="text-[13px] text-white/60">Fetching feeds…</div>
    </div>
  );
}
