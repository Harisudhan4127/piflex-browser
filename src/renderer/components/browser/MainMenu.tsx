import { useRef, useState } from 'react';
import {
  Plus,
  AppWindow,
  ShieldHalf,
  Star,
  BookOpen,
  Clock,
  Download,
  KeyRound,
  Puzzle,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Printer,
  Import,
  Settings,
  HelpCircle,
  Activity,
  Info,
  LogOut,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBrowser } from '@/store/browser-store';
import { app as appApi, win, tabs as tabsApi } from '@/lib/api';

function Item({
  icon,
  label,
  shortcut,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenuItem onSelect={onClick} shortcut={shortcut} danger={danger}>
      <span className="text-[var(--color-text-subtle)]">{icon}</span>
      {label}
    </DropdownMenuItem>
  );
}

export function MainMenu({ children }: { children: React.ReactNode }) {
  const { createTab, setPanel, tabs, activeTabId, settingsData, updateSettings } = useBrowser();
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  void tabs;
  void activeTabId;
  const bookmarksBarVisible = settingsData?.appearance.showBookmarksBar !== false;

  const openPage = (page: string) => void createTab(`piflex://${page}`);

  const applyZoom = (factor: number) => {
    const next = Math.max(0.25, Math.min(5, Number(factor.toFixed(2))));
    zoomRef.current = next;
    setZoom(next);
    if (activeTabId) void tabsApi.zoom(activeTabId, next);
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        // The menu paints over the page, but native web views paint over the
        // shell. Hide the view while the menu is open so it stays clickable.
        win.setViewVisible(!open);
      }}
    >
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <Item icon={<Plus size={15} />} label="New tab" shortcut="Ctrl+T" onClick={() => void createTab()} />
        <Item icon={<AppWindow size={15} />} label="New window" shortcut="Ctrl+N" onClick={() => win.newWindow()} />
        <Item
          icon={<ShieldHalf size={15} />}
          label="New private window"
          shortcut="Ctrl+Shift+N"
          onClick={() => win.newPrivateWindow()}
        />
        <DropdownMenuSeparator />
        <Item icon={<Star size={15} />} label="Bookmarks" shortcut="Ctrl+Shift+O" onClick={() => openPage('bookmarks')} />
        <Item
          icon={<Star size={15} />}
          label={bookmarksBarVisible ? 'Hide bookmarks bar' : 'Show bookmarks bar'}
          shortcut="Ctrl+Shift+B"
          onClick={() => void updateSettings({ appearance: { showBookmarksBar: !bookmarksBarVisible } })}
        />
        <Item icon={<BookOpen size={15} />} label="Reading list" onClick={() => openPage('bookmarks?tab=reading')} />
        <Item icon={<Clock size={15} />} label="History" shortcut="Ctrl+H" onClick={() => openPage('history')} />
        <Item icon={<Download size={15} />} label="Downloads" shortcut="Ctrl+J" onClick={() => openPage('downloads')} />
        <Item icon={<KeyRound size={15} />} label="Password manager" onClick={() => setPanel('passwords')} />
        <Item icon={<Puzzle size={15} />} label="Extensions" onClick={() => setPanel('extensions')} />
        <Item icon={<Sparkles size={15} />} label="PiFlex Assistant" onClick={() => setPanel('ai')} />
        <DropdownMenuSeparator />
        <Item icon={<Search size={15} />} label="Find in page" shortcut="Ctrl+F" onClick={() => useBrowser.getState().openFind()} />
        <DropdownMenuLabel>Zoom</DropdownMenuLabel>
        <Item icon={<ZoomIn size={15} />} label="Zoom in" shortcut="Ctrl+Plus" onClick={() => applyZoom(zoom + 0.1)} />
        <Item icon={<ZoomOut size={15} />} label="Zoom out" shortcut="Ctrl+Minus" onClick={() => applyZoom(zoom - 0.1)} />
        <Item
          icon={<span className="text-[11px] font-medium">{Math.round(zoom * 100)}%</span>}
          label="Reset zoom"
          shortcut="Ctrl+0"
          onClick={() => applyZoom(1)}
        />
        <Item icon={<Printer size={15} />} label="Print" shortcut="Ctrl+P" onClick={() => window.print()} />
        <DropdownMenuSeparator />
        <Item icon={<Import size={15} />} label="Import bookmarks and settings" onClick={() => openPage('settings/import')} />
        <Item icon={<Settings size={15} />} label="Settings" shortcut="Ctrl+," onClick={() => setPanel('settings')} />
        <DropdownMenuSeparator />
        <Item icon={<HelpCircle size={15} />} label="Help" onClick={() => openPage('help')} />
        <Item icon={<Activity size={15} />} label="Diagnostics" onClick={() => openPage('diagnostics')} />
        <Item icon={<Info size={15} />} label="About PiFlex" onClick={() => setPanel('about')} />
        <DropdownMenuSeparator />
        <Item icon={<LogOut size={15} />} label="Exit" shortcut="Ctrl+Q" onClick={() => appApi.quit()} danger />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
