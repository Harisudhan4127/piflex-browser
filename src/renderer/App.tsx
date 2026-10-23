import { lazy, Suspense, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { win } from '@/lib/api';
import { TabStrip } from '@/components/browser/TabStrip';
import { BrowserToolbar } from '@/components/browser/BrowserToolbar';
import { BookmarkBar } from '@/components/browser/BookmarkBar';
import { OverlayPanel } from '@/components/browser/OverlayPanel';
import { FindBar } from '@/components/browser/FindBar';
import { PermissionPrompt } from '@/components/browser/PermissionPrompt';
import { PiFlexLogo } from '@/components/browser/PiFlexLogo';
import { useContentBounds } from '@/lib/useContentBounds';
import { useShortcuts } from '@/lib/useShortcuts';

// Internal pages are lazy-loaded so the shell's initial bundle stays small.
const NewTabPage = lazy(() => import('@/pages/NewTabPage').then((m) => ({ default: m.NewTabPage })));
const BookmarksPage = lazy(() => import('@/pages/BookmarksPage').then((m) => ({ default: m.BookmarksPage })));
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const DownloadsPage = lazy(() => import('@/pages/DownloadsPage').then((m) => ({ default: m.DownloadsPage })));
const PasswordManagerPage = lazy(() =>
  import('@/pages/PasswordManagerPage').then((m) => ({ default: m.PasswordManagerPage })),
);
const ExtensionsPage = lazy(() => import('@/pages/ExtensionsPage').then((m) => ({ default: m.ExtensionsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const HelpPage = lazy(() => import('@/pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const DiagnosticsPage = lazy(() => import('@/pages/DiagnosticsPage').then((m) => ({ default: m.DiagnosticsPage })));
const AboutPage = lazy(() => import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })));

function Spinner() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface)]">
      <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-[var(--color-border)] border-t-accent" />
    </div>
  );
}

function InternalPage({ page }: { page: string }) {
  switch (page) {
    case 'newtab':
    case '':
      return <NewTabPage />;
    case 'bookmarks':
      return <BookmarksPage />;
    case 'history':
      return <HistoryPage />;
    case 'downloads':
      return <DownloadsPage />;
    case 'passwords':
      return <PasswordManagerPage />;
    case 'extensions':
      return <ExtensionsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'help':
      return <HelpPage />;
    case 'diagnostics':
      return <DiagnosticsPage />;
    case 'about':
      return <AboutPage />;
    default:
      return <NewTabPage />;
  }
}

/**
 * The renderer runs in two modes inside the same bundle:
 *  - the browser shell (tab strip, toolbar, panels)
 *  - an internal page (rendered inside a WebContentsView via ?piflexPage=)
 * This keeps one build artifact while preserving the "internal pages are real
 * pages" model of a production browser.
 */
export function App() {
  const params = new URLSearchParams(window.location.search);
  const internalPage = params.get('piflexPage');
  const { init, panel } = useBrowser();
  const activeTabId = useBrowser((s) => s.activeTabId);
  const tabs = useBrowser((s) => s.tabs);
  const showBookmarksBar = useBrowser((s) => s.settingsData?.appearance.showBookmarksBar !== false);
  // Native overlay panels render above the React shell, so the web-content view
  // must shrink to leave room for the sidebar.
  const panelWidth = panel === 'none' ? 0 : panel === 'downloads' ? 380 : 520;
  const contentRef = useContentBounds(!internalPage, panelWidth);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const internalRoute =
    activeTab && activeTab.url.startsWith('piflex://')
      ? activeTab.url.slice('piflex://'.length).split('?')[0]?.replace(/\/+$/, '').split('/')[0] || 'newtab'
      : null;

  useShortcuts(!internalPage);

  useEffect(() => {
    if (!internalPage) void init();
  }, [init, internalPage]);

  if (internalPage) {
    return (
      <Suspense fallback={<Spinner />}>
        <InternalPage page={internalPage} />
      </Suspense>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-surface)]">
      {/* Title bar region (draggable) hosting the tab strip and window controls */}
      <div className="drag flex h-9 items-stretch border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-2 pl-3 pr-1">
          <PiFlexLogo size={18} />
        </div>
        <TabStrip />
        <div className="no-drag flex items-center gap-1 px-1">
          <WindowControls />
        </div>
      </div>

      <BrowserToolbar />
      {showBookmarksBar ? <BookmarkBar /> : null}

      {/* Content viewport: the native WebContentsView is positioned over this box.
          Internal pages are rendered here by the trusted shell instead. */}
      <div ref={contentRef} className="relative min-h-0 flex-1 bg-[var(--color-surface)]">
        {internalRoute ? (
          <Suspense fallback={<Spinner />}>
            <InternalPage page={internalRoute} />
          </Suspense>
        ) : null}
      </div>

      {panel !== 'none' ? <OverlayPanel /> : null}
      <FindBar />
      <PermissionPrompt />
    </div>
  );
}

function WindowControls() {
  const maximized = useBrowser((s) => s.maximized);
  // macOS keeps its native traffic lights (titleBarStyle: hiddenInset).
  if (/Mac/i.test(navigator.userAgent)) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Minimize"
        onClick={win.minimize}
        className="flex h-8 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)]"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={win.toggleMaximize}
        className="flex h-8 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)]"
      >
        {maximized ? <Copy size={13} /> : <Square size={13} />}
      </button>
      <button
        type="button"
        aria-label="Close"
        onClick={win.close}
        className="flex h-8 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger)] hover:text-white"
      >
        <X size={15} />
      </button>
    </>
  );
}
