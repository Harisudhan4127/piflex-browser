import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { InternalPageLayout } from '@/components/InternalPageLayout';
import { Button } from '@/components/ui/button';
import { diagnostics as diagnosticsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DiagnosticsInfo } from '@shared/types';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--color-text)]">{value}</div>
      {hint ? <div className="text-[11px] text-[var(--color-text-subtle)]">{hint}</div> : null}
    </div>
  );
}

export function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await diagnosticsApi.get();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [load]);

  const system = data?.system;

  return (
    <InternalPageLayout
      page="diagnostics"
      title="Diagnostics"
      subtitle="Live resource usage for PiFlex's own processes"
      actions={
        <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin-slow' : ''} /> Refresh
        </Button>
      }
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-[12px] text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      {!data ? (
        <div className="py-20 text-center text-[13px] text-[var(--color-text-subtle)]">Loading diagnostics…</div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text)]">
              <Activity size={14} /> Memory
            </h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat
                label="PiFlex processes"
                value={`${data.appMemoryMB} MB`}
                hint="Sum of Electron processes"
              />
              <Stat label="Main heap" value={`${data.mainHeapMB} MB`} hint="Browser process JS heap" />
              <Stat
                label="System used"
                value={system ? `${system.usedMB} MB` : '—'}
                hint={system ? `of ${system.totalMB} MB total` : undefined}
              />
              <Stat
                label="System free"
                value={system ? `${system.freeMB} MB` : '—'}
                hint={system ? `${Math.round(system.pressure * 100)}% free` : undefined}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
              “PiFlex processes” covers the browser process, the shell renderer, one renderer per active tab,
              and the GPU process. It is not the same as total system memory in use by other applications.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-[13px] font-semibold text-[var(--color-text)]">Processes</h2>
            <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-[var(--color-surface-overlay)] text-[var(--color-text-subtle)]">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Type</th>
                    <th className="px-3 py-1.5 font-medium">Name</th>
                    <th className="px-3 py-1.5 text-right font-medium">PID</th>
                    <th className="px-3 py-1.5 text-right font-medium">Memory</th>
                    <th className="px-3 py-1.5 text-right font-medium">CPU</th>
                  </tr>
                </thead>
                <tbody>
                  {data.processes.map((proc) => (
                    <tr key={`${proc.type}-${proc.pid}`} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-1.5 text-[var(--color-text)]">{proc.type}</td>
                      <td className="max-w-[220px] truncate px-3 py-1.5 text-[var(--color-text-muted)]" title={proc.name}>
                        {proc.name}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-subtle)]">{proc.pid}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text)]">{proc.memoryMB} MB</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-muted)]">
                        {proc.cpuPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-border)] p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-[var(--color-text)]">Tabs</h2>
              <dl className="grid grid-cols-2 gap-y-1 text-[12px]">
                <dt className="text-[var(--color-text-subtle)]">Total</dt>
                <dd className="text-right tabular-nums text-[var(--color-text)]">{data.tabs.total}</dd>
                <dt className="text-[var(--color-text-subtle)]">Active</dt>
                <dd className="text-right tabular-nums text-[var(--color-text)]">{data.tabs.active}</dd>
                <dt className="text-[var(--color-text-subtle)]">Private</dt>
                <dd className="text-right tabular-nums text-[var(--color-text)]">{data.tabs.private}</dd>
                <dt className="text-[var(--color-text-subtle)]">Internal pages</dt>
                <dd className="text-right tabular-nums text-[var(--color-text)]">{data.tabs.internal}</dd>
                <dt className="text-[var(--color-text-subtle)]">Suspended</dt>
                <dd className="text-right tabular-nums text-[var(--color-text)]">{data.tabs.suspended}</dd>
              </dl>
              <p className="mt-2 text-[11px] text-[var(--color-text-subtle)]">
                Automatic tab suspension is not enabled yet; suspended tab content is not discarded in this build.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-[var(--color-text)]">Features</h2>
              <dl className="grid grid-cols-2 gap-y-1 text-[12px]">
                <dt className="text-[var(--color-text-subtle)]">AI</dt>
                <dd className="text-right text-[var(--color-text)]">
                  <span className={cn(data.ai.enabled ? 'text-accent' : 'text-[var(--color-text-muted)]')}>
                    {data.ai.enabled ? (data.ai.ready ? 'Ready' : 'Enabled') : 'Off'}
                  </span>
                </dd>
                <dt className="text-[var(--color-text-subtle)]">AI provider</dt>
                <dd className="truncate text-right text-[var(--color-text)]">{data.ai.provider}</dd>
                <dt className="text-[var(--color-text-subtle)]">Ad blocking</dt>
                <dd className="text-right text-[var(--color-text)]">{data.adblock.enabled ? 'On' : 'Off'}</dd>
                <dt className="text-[var(--color-text-subtle)]">Filter rules</dt>
                <dd className="text-right tabular-nums text-[var(--color-text)]">
                  {data.adblock.rulesCount.toLocaleString()}
                </dd>
              </dl>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-[13px] font-semibold text-[var(--color-text)]">System</h2>
            <div className="rounded-lg border border-[var(--color-border)] p-3 text-[12px] text-[var(--color-text-muted)]">
              <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                <div>
                  Platform: <span className="text-[var(--color-text)]">{system?.platform} ({system?.archFamily})</span>
                </div>
                <div>
                  CPU: <span className="text-[var(--color-text)]">{system?.cpuModel}</span>
                </div>
                <div>
                  Cores: <span className="text-[var(--color-text)]">{system?.cpuCores}</span>
                </div>
                <div>
                  OS release: <span className="text-[var(--color-text)]">{system?.osRelease}</span>
                </div>
                <div>
                  App: <span className="text-[var(--color-text)]">{system?.appVersion}</span>
                </div>
                <div>
                  Electron: <span className="text-[var(--color-text)]">{system?.versions.electron}</span>
                </div>
                <div>
                  Chromium: <span className="text-[var(--color-text)]">{system?.versions.chrome}</span>
                </div>
                <div>
                  Node: <span className="text-[var(--color-text)]">{system?.versions.node}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </InternalPageLayout>
  );
}
