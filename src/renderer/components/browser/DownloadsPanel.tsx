import { useEffect } from 'react';
import {
  Download,
  FileWarning,
  Pause,
  Play,
  X,
  FolderOpen,
  Trash2,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { downloads as downloadsApi } from '@/lib/api';
import { PanelShell, EmptyState } from './PanelShell';
import { Button } from '@/components/ui/button';
import { cn, formatBytes, relativeTime } from '@/lib/utils';

function statusLabel(state: string): string {
  switch (state) {
    case 'progressing':
      return 'Downloading';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'interrupted':
      return 'Failed';
    default:
      return state;
  }
}

export function DownloadsPanel({ onClose }: { onClose: () => void }) {
  const { downloads, refreshDownloads } = useBrowser();

  useEffect(() => {
    void refreshDownloads();
  }, [refreshDownloads]);

  const items = downloads;

  return (
    <PanelShell
      title="Downloads"
      onClose={onClose}
      headerActions={
        items.length > 0 ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[12px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]"
            onClick={() => {
              void Promise.all(items.map((d) => downloadsApi.remove(d.id))).then(() => refreshDownloads());
            }}
          >
            Clear removed
          </button>
        ) : null
      }
    >
      {items.length === 0 ? (
        <EmptyState icon={<Download size={22} />} title="No downloads yet" hint="Files you download will appear here." />
      ) : (
        <ul className="p-2">
          {items.map((item) => {
            const pct = item.totalBytes > 0 ? Math.min(100, (item.receivedBytes / item.totalBytes) * 100) : 0;
            return (
              <li key={item.id} className="mb-1 rounded-lg border border-[var(--color-border)] p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]">
                    {item.danger ? <FileWarning size={16} className="text-[var(--color-warning)]" /> : <FileText size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-text)]">
                        {item.filename}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-[11px]',
                          item.state === 'completed'
                            ? 'text-[var(--color-success)]'
                            : item.state === 'interrupted'
                              ? 'text-[var(--color-danger)]'
                              : 'text-[var(--color-text-subtle)]',
                        )}
                      >
                        {statusLabel(item.state)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[var(--color-text-subtle)]">{item.url}</div>

                    {item.state === 'progressing' || item.state === 'paused' ? (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-border)]">
                        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
                      </div>
                    ) : null}

                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--color-text-subtle)]">
                      <span>
                        {formatBytes(item.receivedBytes)}
                        {item.totalBytes > 0 ? ` / ${formatBytes(item.totalBytes)}` : ''}
                      </span>
                      <span>{relativeTime(item.startedAt)}</span>
                    </div>

                    {item.danger ? (
                      <div className="mt-1.5 rounded-md bg-[var(--color-danger-soft)] px-2 py-1 text-[11px] text-[var(--color-danger)]">
                        This file type can run code. Only open it if you trust the source.
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {item.state === 'completed' ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => void downloadsApi.open(item.id)}>
                            <FolderOpen size={13} /> Open
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void downloadsApi.showInFolder(item.id)}>
                            Show in folder
                          </Button>
                        </>
                      ) : null}
                      {item.state === 'progressing' ? (
                        <Button size="sm" variant="secondary" onClick={() => void downloadsApi.pause(item.id)}>
                          <Pause size={13} /> Pause
                        </Button>
                      ) : null}
                      {item.state === 'paused' ? (
                        <Button size="sm" variant="secondary" onClick={() => void downloadsApi.resume(item.id)}>
                          <Play size={13} /> Resume
                        </Button>
                      ) : null}
                      {(item.state === 'interrupted' || item.state === 'cancelled') && item.canResume ? (
                        <Button size="sm" variant="secondary" onClick={() => void downloadsApi.retry(item.id)}>
                          <RotateCcw size={13} /> Retry
                        </Button>
                      ) : null}
                      {item.state === 'progressing' || item.state === 'paused' ? (
                        <Button size="sm" variant="ghost" onClick={() => void downloadsApi.cancel(item.id)}>
                          <X size={13} /> Cancel
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void downloadsApi.remove(item.id).then(() => refreshDownloads())}
                        >
                          <Trash2 size={13} /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}
