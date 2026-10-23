import { useState } from 'react';
import { Plus, X, Volume2, VolumeX, Pin, Shield } from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, hostOf } from '@/lib/utils';
import type { TabState } from '@shared/types';

function Favicon({ tab }: { tab: TabState }) {
  const [failed, setFailed] = useState(false);
  const showIcon = tab.favicon && !failed;
  if (showIcon) {
    return (
      <img
        src={tab.favicon ?? undefined}
        alt=""
        className="h-3.5 w-3.5 shrink-0 rounded-[3px]"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-[var(--color-text-subtle)]" />
    </span>
  );
}

function TabItem({
  tab,
  active,
  index,
  dragId,
  setDragId,
  onDrop,
}: {
  tab: TabState;
  active: boolean;
  index: number;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDrop: (fromId: string, toIndex: number) => void;
}) {
  const { activateTab, closeTab, toggleMute } = useBrowser();
  const title = tab.title || hostOf(tab.url) || 'New Tab';

  return (
    <div
      draggable={!tab.pinned}
      onDragStart={() => setDragId(tab.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        if (dragId && dragId !== tab.id) onDrop(dragId, index);
        setDragId(null);
      }}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          void closeTab(tab.id);
        }
      }}
      onClick={() => activateTab(tab.id)}
      className={cn(
        'group no-drag relative flex h-8 min-w-[42px] cursor-default items-center gap-2 rounded-md px-2 text-[12.5px] transition-colors',
        tab.pinned ? 'max-w-[44px] justify-center' : 'max-w-[220px] min-w-[120px] flex-1',
        active
          ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text)]'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]/60',
      )}
      data-tab-id={tab.id}
      role="tab"
      aria-selected={active}
    >
      {tab.pinned ? (
        <Favicon tab={tab} />
      ) : (
        <>
          {tab.loading ? (
            <span className="h-3 w-3 shrink-0 animate-spin-slow rounded-full border-[1.5px] border-[var(--color-text-subtle)] border-t-accent" />
          ) : (
            <Favicon tab={tab} />
          )}
          <span className="flex-1 truncate">{title}</span>
          {tab.audible || tab.muted ? (
            <button
              type="button"
              aria-label={tab.muted ? 'Unmute tab' : 'Mute tab'}
              onClick={(e) => {
                e.stopPropagation();
                void toggleMute(tab.id);
              }}
              className="rounded p-0.5 text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
            >
              {tab.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Close tab"
            onClick={(e) => {
              e.stopPropagation();
              void closeTab(tab.id);
            }}
            className={cn(
              'rounded p-0.5 text-[var(--color-text-subtle)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]',
              active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
          >
            <X size={13} />
          </button>
        </>
      )}
      {tab.private ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--color-surface)]">
          <Shield size={9} className="text-accent" />
        </span>
      ) : null}
      {tab.pinned && !active ? <Pin size={10} className="absolute bottom-0.5 right-0.5 text-[var(--color-text-subtle)]" /> : null}
    </div>
  );
}

export function TabStrip() {
  const { tabs, tabOrder, activeTabId, createTab, reorderTabs, closeTab, activateTab } = useBrowser();
  const [dragId, setDragId] = useState<string | null>(null);

  const ordered = tabOrder
    .map((id) => tabs.find((t) => t.id === id))
    .filter((t): t is TabState => Boolean(t));

  const handleDrop = (fromId: string, toIndex: number) => {
    const order = tabOrder.filter((id) => id !== fromId);
    const target = ordered[toIndex];
    const insertAt = target ? Math.max(0, order.indexOf(target.id)) : order.length;
    order.splice(insertAt, 0, fromId);
    reorderTabs(order);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (tabs.length < 2) return;
    const current = tabOrder.indexOf(activeTabId ?? '');
    const next = e.deltaY > 0 ? Math.min(tabOrder.length - 1, current + 1) : Math.max(0, current - 1);
    const target = tabOrder[next];
    if (target && target !== activeTabId) activateTab(target);
  };

  return (
    <div className="flex h-9 min-w-0 flex-1 items-center gap-1 px-2" onWheel={handleWheel}>
      <div className="drag flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {ordered.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            index={index}
            active={tab.id === activeTabId}
            dragId={dragId}
            setDragId={setDragId}
            onDrop={handleDrop}
          />
        ))}
      </div>
      <Tooltip label="New tab" shortcut="Ctrl+T" side="bottom">
        <button
          type="button"
          onClick={() => void createTab()}
          aria-label="New tab"
          className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
        >
          <Plus size={16} />
        </button>
      </Tooltip>
      {tabOrder.length > 1 ? (
        <Tooltip label="More tab actions" side="bottom">
          <button
            type="button"
            aria-label="Close current tab"
            onClick={() => activeTabId && void closeTab(activeTabId)}
            className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
          >
            <X size={14} />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
