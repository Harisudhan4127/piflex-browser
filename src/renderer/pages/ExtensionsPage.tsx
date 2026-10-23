import { useEffect, useState } from 'react';
import { Puzzle, Plus, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { InternalPageLayout, PageEmpty } from '@/components/InternalPageLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { extensions as extensionsApi, permissions as permissionsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ExtensionInfo, PermissionOverride } from '@shared/types';

export function ExtensionsPage() {
  const [items, setItems] = useState<ExtensionInfo[]>([]);
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    void extensionsApi.list().then(setItems).catch(() => undefined);
    void permissionsApi.list().then(setOverrides).catch(() => undefined);
  };
  useEffect(load, []);

  const install = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await extensionsApi.install();
      if (result) setItems((prev) => [...prev.filter((e) => e.id !== result.id), result]);
      else setNotice('No extension was installed.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Install failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <InternalPageLayout
      page="extensions"
      title="Extensions"
      subtitle={`${items.length} installed`}
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </Button>
          <Button size="sm" onClick={() => void install()} disabled={busy}>
            <Plus size={13} /> Load unpacked
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-[12px] text-[var(--color-text-subtle)]">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <span>
          PiFlex uses Electron&apos;s extension runtime, which supports a subset of Chromium
          extensions (unpacked MV2/MV3). Chrome Web Store installation is not supported and some
          extension APIs are unavailable.
        </span>
      </div>

      {notice ? (
        <div className="mb-4 rounded-md bg-[var(--color-danger-soft)] px-3 py-2 text-[12px] text-[var(--color-danger)]">
          {notice}
        </div>
      ) : null}

      {items.length === 0 ? (
        <PageEmpty title="No extensions installed" hint="Load an unpacked extension folder to get started." />
      ) : (
        <ul className="space-y-2">
          {items.map((ext) => (
            <li key={ext.id} className="rounded-xl border border-[var(--color-border)] p-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]">
                  <Puzzle size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--color-text)]">
                      {ext.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--color-text-subtle)]">v{ext.version}</span>
                    <Switch
                      checked={ext.enabled}
                      onCheckedChange={async (checked) => {
                        const updated = await extensionsApi.setEnabled(ext.id, checked).catch(() => null);
                        if (updated) setItems((prev) => prev.map((e) => (e.id === ext.id ? updated : e)));
                        else load();
                      }}
                    />
                  </div>
                  {ext.description ? (
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{ext.description}</p>
                  ) : null}
                  {ext.permissions.length > 0 || ext.hostPermissions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ext.permissions.slice(0, 8).map((p) => (
                        <span
                          key={p}
                          className="rounded bg-[var(--color-surface-overlay)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
                        >
                          {p}
                        </span>
                      ))}
                      {ext.hostPermissions.length > 0 ? (
                        <span className="rounded bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-[10px] text-[var(--color-warning)]">
                          {ext.hostPermissions.length} site permissions
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {ext.error ? (
                    <div className="mt-1.5 text-[11px] text-[var(--color-danger)]">{ext.error}</div>
                  ) : null}
                  <div className="mt-2 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(ext.toolbarVisible ? 'text-accent' : '')}
                      onClick={async () => {
                        const updated = await extensionsApi.setToolbar(ext.id, !ext.toolbarVisible).catch(() => null);
                        if (updated) setItems((prev) => prev.map((e) => (e.id === ext.id ? updated : e)));
                      }}
                    >
                      {ext.toolbarVisible ? 'Hide from toolbar' : 'Show in toolbar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void extensionsApi.remove(ext.id).then(load)}>
                      <Trash2 size={13} /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          Site permissions
        </h2>
        {overrides.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-subtle)]">No site permission decisions saved yet.</p>
        ) : (
          <ul className="space-y-1">
            {overrides.map((o) => (
              <li
                key={`${o.origin}-${o.permission}`}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-[var(--color-text)]">{o.origin}</div>
                  <div className="text-[11px] text-[var(--color-text-subtle)]">{o.permission}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-[11px]',
                      o.decision === 'allow' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
                    )}
                  >
                    {o.decision}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void permissionsApi.clear(o.origin, o.permission).then(setOverrides)}
                  >
                    Reset
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </InternalPageLayout>
  );
}
