import { useEffect, useState } from 'react';
import { ExternalLink, Cpu, HardDrive, ShieldCheck, Heart } from 'lucide-react';
import { InternalPageLayout } from '@/components/InternalPageLayout';
import { PiFlexLogo } from '@/components/browser/PiFlexLogo';
import { Button } from '@/components/ui/button';
import { app, settings as settingsApi, piflex } from '@/lib/api';
import type { AppInfo, HardwareInfo } from '@shared/types';

const SUPPORTED = [
  'Tabbed browsing with per-tab web content processes',
  'Address bar with search + history/bookmark suggestions',
  'Bookmarks, history, downloads (SQLite-backed)',
  'Network-level ad/tracker blocking with filter lists',
  'Encrypted password vault via the OS keychain',
  'Permission prompts with per-site memory',
];

const LIMITATIONS = [
  'Extensions: only a subset of Chromium APIs via Electron; no Chrome Web Store installs',
  'No cloud profile sync — nothing leaves your device',
  'No built-in VPN, rewards, or “private search” proxy',
  'Site isolation/fingerprinting defenses are limited to what Chromium/Electron provide',
];

export function AboutPage() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);

  useEffect(() => {
    void app.info().then(setInfo).catch(() => undefined);
    void settingsApi.hardware().then(setHardware).catch(() => undefined);
  }, []);

  const open = (url: string) => void piflex.openExternal(url);

  return (
    <InternalPageLayout page="about" title="About PiFlex Browser" subtitle={info ? `Version ${info.version}` : undefined}>
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-elevated)]">
          <PiFlexLogo size={34} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">PiFlex Browser</h2>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            A modern, lightweight, privacy-focused desktop browser.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Version" value={info?.version ?? '—'} />
        <Stat label="Electron" value={info?.electron ?? '—'} />
        <Stat label="Chromium" value={info?.chromium ?? '—'} />
        <Stat label="Node" value={info?.node ?? '—'} />
        <Stat label="Platform" value={info?.platform ?? '—'} />
        <Stat label="Arch" value={hardware?.arch ?? '—'} />
      </div>

      {hardware ? (
        <section className="mt-8">
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
            <Cpu size={13} /> System
          </h3>
          <div className="rounded-xl border border-[var(--color-border)] p-4 text-[12px] text-[var(--color-text-muted)]">
            <Row label="CPU" value={hardware.cpuModel || 'Unknown'} />
            <Row label="Logical cores" value={String(hardware.cpuCount)} />
            <Row label="Total memory" value={`${Math.round(hardware.totalMemoryMB / 1024)} GB`} />
            <Row label="Disk cache" value={`${hardware.recommendedDiskCacheMB} MB`} />
            <Row
              label="Tab guidance"
              value={
                hardware.recommendedMaxTabs > 0
                  ? `up to ~${hardware.recommendedMaxTabs} before memory pressure`
                  : 'memory-pressure management off'
              }
            />
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          <ShieldCheck size={13} /> What PiFlex does
        </h3>
        <ul className="space-y-1.5">
          {SUPPORTED.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[12px] text-[var(--color-text-muted)]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          <HardDrive size={13} /> What PiFlex is honest about
        </h3>
        <ul className="space-y-1.5">
          {LIMITATIONS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[12px] text-[var(--color-text-subtle)]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-text-subtle)]" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-5">
        <Button variant="outline" onClick={() => open('https://github.com/')}>
          <ExternalLink size={13} /> Source
        </Button>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-subtle)]">
          Built with <Heart size={12} className="text-accent" /> using Electron and React.
        </span>
      </div>
    </InternalPageLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2">
      <div className="text-[11px] text-[var(--color-text-subtle)]">{label}</div>
      <div className="truncate text-[13px] font-medium text-[var(--color-text)]">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 py-1.5 last:border-0">
      <span className="text-[var(--color-text-subtle)]">{label}</span>
      <span className="truncate pl-4 text-[var(--color-text)]">{value}</span>
    </div>
  );
}
