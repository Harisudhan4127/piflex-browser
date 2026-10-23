import { useEffect, useState } from 'react';
import { Puzzle, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { extensions as extensionsApi } from '@/lib/api';
import { PanelShell, EmptyState } from './PanelShell';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ExtensionInfo } from '@shared/types';

export function ExtensionsPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ExtensionInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => void extensionsApi.list().then(setItems).catch(() => undefined);
  useEffect(load, []);

  const install = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await extensionsApi.install();
      if (result) setItems((prev) => [...prev.filter((e) => e.id !== result.id), result]);
      else setNotice('No extension installed.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Install failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Extensions"
      onClose={onClose}
      wide
      headerActions={
        <Button size="sm" variant="secondary" onClick={() => void install()} disabled={busy}>
          <Plus size={13} /> Load unpacked
        </Button>
      }
    >
      <div className="p-4">
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[11px] text-[var(--color-text-subtle)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
          <span>
            PiFlex uses Electron&apos;s extension runtime, which supports a subset of Chromium
            extensions (unpacked MV2/MV3). Chrome Web Store installation is not supported, and some
            extension APIs are unavailable. Extensions are loaded from a folder you choose.
          </span>
        </div>

        {notice ? (
          <div className="mb-3 rounded-md bg-[var(--color-danger-soft)] px-3 py-2 text-[12px] text-[var(--color-danger)]">
            {notice}
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={<Puzzle size={22} />}
            title="No extensions installed"
            hint="Load an unpacked extension folder to get started."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((ext) => (
              <li
                key={ext.id}
                className="rounded-lg border border-[var(--color-border)] p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]">
                    <Puzzle size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-text)]">
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
                        {ext.permissions.slice(0, 6).map((p) => (
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await extensionsApi.remove(ext.id).catch(() => undefined);
                          load();
                        }}
                      >
                        <Trash2 size={13} /> Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelShell>
  );
}
