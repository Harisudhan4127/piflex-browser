import { Shield, BarChart3 } from 'lucide-react';
import { useBrowser } from '@/store/browser-store';

/**
 * Honest privacy statistics. These counters reflect real network requests that
 * the adblock engine cancelled plus real tracker categorisation; nothing here
 * is fabricated or estimated.
 */
export function PrivacyStatsWidget() {
  const { privacyStats } = useBrowser();
  const total = privacyStats.adsBlocked + privacyStats.trackersBlocked;

  return (
    <div className="flex items-center justify-center gap-6 rounded-2xl border border-white/10 bg-black/20 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Shield size={18} />
        </span>
        <div>
          <div className="text-xl font-semibold tabular-nums text-white">{total.toLocaleString()}</div>
          <div className="text-[11px] uppercase tracking-wide text-white/60">Trackers &amp; ads blocked</div>
        </div>
      </div>
      <div className="h-8 w-px bg-white/10" />
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70">
          <BarChart3 size={18} />
        </span>
        <div>
          <div className="text-xl font-semibold tabular-nums text-white">{privacyStats.adsBlocked.toLocaleString()}</div>
          <div className="text-[11px] uppercase tracking-wide text-white/60">Ads blocked</div>
        </div>
      </div>
      <div className="h-8 w-px bg-white/10" />
      <div className="text-left">
        <div className="text-xl font-semibold tabular-nums text-white">{privacyStats.trackersBlocked.toLocaleString()}</div>
        <div className="text-[11px] uppercase tracking-wide text-white/60">Trackers blocked</div>
      </div>
    </div>
  );
}
