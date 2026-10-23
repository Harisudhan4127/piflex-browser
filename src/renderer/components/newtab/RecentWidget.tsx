import { History as HistoryIcon, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBrowser } from '@/store/browser-store';
import { history as historyApi } from '@/lib/api';
import { hostOf, relativeTime } from '@/lib/utils';
import type { HistoryEntry } from '@shared/types';

export function RecentWidget() {
  const { createTab, historyEntries } = useBrowser();
  const [recent, setRecent] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (historyEntries.length) {
      setRecent(historyEntries.slice(0, 6));
      return;
    }
    void historyApi.list(0, 6).then(setRecent).catch(() => undefined);
  }, [historyEntries]);

  if (recent.length === 0) return null;

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-[12px] uppercase tracking-wide text-white/60">
        <HistoryIcon size={14} />
        Recently visited
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {recent.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => void createTab(entry.url)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/10"
          >
            <RotateCcw size={13} className="shrink-0 text-white/40" />
            <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">
              {entry.title || hostOf(entry.url)}
            </span>
            <span className="shrink-0 text-[11px] text-white/40">{relativeTime(entry.lastVisit)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
