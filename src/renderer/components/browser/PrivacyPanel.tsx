import { useEffect, useState } from 'react';
import { Shield, ShieldOff, RefreshCw } from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { privacy as privacyApi } from '@/lib/api';
import { PanelShell } from './PanelShell';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn, hostOf } from '@/lib/utils';
import type { AdblockStatus } from '@shared/types';

export function PrivacyPanel({ onClose }: { onClose: () => void }) {
  const { tabs, activeTabId, privacyStats, settingsData, updateSettings } = useBrowser();
  const active = tabs.find((t) => t.id === activeTabId) ?? null;
  const [status, setStatus] = useState<AdblockStatus | null>(null);
  const [lists, setLists] = useState<{ id: string; name: string; description: string; category: string; enabled: boolean }[]>([]);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    const [s, l] = await Promise.all([
      privacyApi.status(active?.url ?? '').catch(() => null),
      privacyApi.filterLists().catch(() => []),
    ]);
    setStatus(s);
    setLists(l);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.url]);

  const toggleSite = async (exempt: boolean) => {
    if (!active) return;
    const next = await privacyApi.toggleSite(active.url, exempt).catch(() => null);
    if (next) setStatus(next);
  };

  const toggleList = async (id: string, enabled: boolean) => {
    const ids = lists.filter((l) => (l.id === id ? enabled : l.enabled)).map((l) => l.id);
    const next = await privacyApi.setFilterLists(ids).catch(() => null);
    if (next) setStatus(next);
    await load();
  };

  const total = privacyStats.adsBlocked + privacyStats.trackersBlocked;
  const globalEnabled = Boolean(settingsData?.privacy?.adblock);

  return (
    <PanelShell title="Privacy" onClose={onClose} wide>
      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-accent">
              <Shield size={20} />
            </span>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                {total.toLocaleString()}
              </div>
              <div className="text-[12px] text-[var(--color-text-muted)]">
                requests blocked this session
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
            <div className="rounded-lg bg-[var(--color-surface-overlay)] px-3 py-2">
              <div className="text-[var(--color-text-subtle)]">Ads blocked</div>
              <div className="text-base font-medium tabular-nums text-[var(--color-text)]">
                {privacyStats.adsBlocked.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg bg-[var(--color-surface-overlay)] px-3 py-2">
              <div className="text-[var(--color-text-subtle)]">Trackers blocked</div>
              <div className="text-base font-medium tabular-nums text-[var(--color-text)]">
                {privacyStats.trackersBlocked.toLocaleString()}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
            Counts reflect network requests cancelled by the filter engine. PiFlex does not claim
            fingerprinting protection beyond what the bundled engine provides.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2.5">
          <div>
            <div className="text-[13px] text-[var(--color-text)]">Block ads &amp; trackers</div>
            <div className="text-[11px] text-[var(--color-text-subtle)]">Applies to all sites</div>
          </div>
          <Switch
            checked={globalEnabled}
            onCheckedChange={(checked) => void updateSettings({ privacy: { adblock: checked } }).then(load)}
          />
        </div>

        {active && !active.url.startsWith('piflex://') ? (
          <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-[13px] text-[var(--color-text)]">
                {hostOf(active.url)}
              </div>
              <div className="text-[11px] text-[var(--color-text-subtle)]">
                {status?.siteExempt ? 'Protection disabled for this site' : 'Protection active'}
              </div>
            </div>
            <Switch
              checked={!status?.siteExempt}
              onCheckedChange={(checked) => void toggleSite(!checked)}
              disabled={!globalEnabled}
            />
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Filter lists
            </h3>
            <Button
              size="sm"
              variant="ghost"
              disabled={updating}
              onClick={async () => {
                setUpdating(true);
                await privacyApi.updateLists().catch(() => undefined);
                await load();
                setUpdating(false);
              }}
            >
              <RefreshCw size={13} className={updating ? 'animate-spin-slow' : ''} /> Update
            </Button>
          </div>
          <div className="space-y-1.5">
            {lists.map((list) => (
              <div
                key={list.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2"
              >
                <div className="min-w-0 pr-3">
                  <div className="text-[13px] text-[var(--color-text)]">{list.name}</div>
                  <div className="truncate text-[11px] text-[var(--color-text-subtle)]">{list.description}</div>
                </div>
                <Switch
                  checked={list.enabled}
                  disabled={!globalEnabled}
                  onCheckedChange={(checked) => void toggleList(list.id, checked)}
                />
              </div>
            ))}
          </div>
          {status ? (
            <div className={cn('mt-2 text-[11px]', globalEnabled ? 'text-[var(--color-text-subtle)]' : 'text-[var(--color-danger)]')}>
              {globalEnabled ? (
                <>
                  {status.rulesCount.toLocaleString()} rules active
                  {status.lastUpdated ? ` · updated ${new Date(status.lastUpdated).toLocaleDateString()}` : ''}
                </>
              ) : (
                <>
                  <ShieldOff size={12} className="mr-1 inline" />
                  Protection is currently disabled
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </PanelShell>
  );
}
