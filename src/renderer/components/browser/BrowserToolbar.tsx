import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  X,
  Shield,
  Puzzle,
  Download,
  User,
  Sparkles,
  MoreVertical,
} from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { tabs as tabsApi } from '@/lib/api';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AddressBar } from './AddressBar';
import { MainMenu } from './MainMenu';

function NavButton({
  label,
  shortcut,
  onClick,
  disabled,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          disabled
            ? 'text-[var(--color-text-subtle)] opacity-40'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]',
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ToolbarControl({
  label,
  onClick,
  children,
  badge,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
  active?: boolean;
}) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          'no-drag relative flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          active
            ? 'bg-[var(--color-accent-soft)] text-accent'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]',
        )}
      >
        {children}
        {badge && badge > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

export function BrowserToolbar() {
  const {
    tabs,
    activeTabId,
    reloadActive,
    backActive,
    forwardActive,
    navigateHome,
    setPanel,
    panel,
    downloads,
    privacyStats,
  } = useBrowser();

  const active = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeDownloads = downloads.filter((d) => d.state === 'progressing').length;
  const blocked = privacyStats.adsBlocked + privacyStats.trackersBlocked;

  return (
    <div className="flex h-11 items-center gap-1.5 px-2">
      <div className="no-drag flex items-center gap-0.5">
        <NavButton label="Back" shortcut="Alt+Left" onClick={backActive} disabled={!active?.canGoBack}>
          <ArrowLeft size={17} />
        </NavButton>
        <NavButton label="Forward" shortcut="Alt+Right" onClick={forwardActive} disabled={!active?.canGoForward}>
          <ArrowRight size={17} />
        </NavButton>
        {active?.loading ? (
          <NavButton label="Stop" shortcut="Esc" onClick={() => activeTabId && void tabsApi.stop(activeTabId)}>
            <X size={16} />
          </NavButton>
        ) : (
          <NavButton label="Reload" shortcut="Ctrl+R" onClick={reloadActive}>
            <RotateCw size={15} />
          </NavButton>
        )}
        <NavButton label="Home" shortcut="Alt+Home" onClick={navigateHome}>
          <Home size={16} />
        </NavButton>
      </div>

      <AddressBar />

      <div className="no-drag flex items-center gap-0.5">
        <ToolbarControl
          label="Privacy and site protection"
          badge={blocked}
          onClick={() => setPanel(panel === 'privacy' ? 'none' : 'privacy')}
        >
          <Shield size={16} className={blocked > 0 ? 'text-accent' : undefined} />
        </ToolbarControl>
        <ToolbarControl label="Extensions" onClick={() => setPanel('extensions')}>
          <Puzzle size={16} />
        </ToolbarControl>
        <ToolbarControl label="Downloads" badge={activeDownloads} onClick={() => setPanel('downloads')}>
          <Download size={16} />
        </ToolbarControl>
        <ToolbarControl label="Passwords and autofill" onClick={() => setPanel('passwords')}>
          <User size={16} />
        </ToolbarControl>
        <ToolbarControl
          label="PiFlex Assistant"
          active={panel === 'ai'}
          onClick={() => setPanel(panel === 'ai' ? 'none' : 'ai')}
        >
          <Sparkles size={16} />
        </ToolbarControl>
        <MainMenu>
          <button
            type="button"
            aria-label="Main menu"
            className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
          >
            <MoreVertical size={17} />
          </button>
        </MainMenu>
      </div>
    </div>
  );
}
