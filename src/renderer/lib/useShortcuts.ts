import { useEffect } from 'react';
import { useBrowser } from '@/store/browser-store';
import { piflex, win } from '@/lib/api';

/**
 * Global browser keyboard shortcuts. Registered on the shell renderer (not on
 * web content) so page scripts cannot intercept browser-level commands.
 */
export function useShortcuts(enabled: boolean) {
  const store = useBrowser;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const state = store.getState();

      // Ctrl+T: new tab
      if (mod && !e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        void state.createTab();
        return;
      }
      // Ctrl+W: close tab
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (state.activeTabId) void state.closeTab(state.activeTabId);
        return;
      }
      // Ctrl+Shift+N: private window
      if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        win.newPrivateWindow();
        return;
      }
      // Ctrl+N: new window
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        win.newWindow();
        return;
      }
      // Ctrl+L / Alt+D: focus address bar
      if ((mod && e.key.toLowerCase() === 'l') || (e.altKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        window.dispatchEvent(new Event('piflex:focus-address'));
        return;
      }
      // Ctrl+F: find in page
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        state.openFind();
        return;
      }
      // Escape: close overlays
      if (e.key === 'Escape') {
        if (state.find.open) state.closeFind();
        else if (state.panel !== 'none') state.setPanel('none');
        return;
      }
      // Ctrl+Tab / Ctrl+Shift+Tab: cycle tabs
      if (mod && e.key === 'Tab') {
        e.preventDefault();
        const order = state.tabOrder;
        const current = order.indexOf(state.activeTabId ?? '');
        if (order.length < 2) return;
        const next = e.shiftKey
          ? (current - 1 + order.length) % order.length
          : (current + 1) % order.length;
        const id = order[next];
        if (id) state.activateTab(id);
        return;
      }
      // Alt+Left / Alt+Right: history navigation
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        state.backActive();
        return;
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        state.forwardActive();
        return;
      }
      // Ctrl+R / F5: reload
      if ((mod && e.key.toLowerCase() === 'r') || e.key === 'F5') {
        e.preventDefault();
        state.reloadActive();
        return;
      }
      // Ctrl+H: history, Ctrl+J: downloads, Ctrl+,: settings
      if (mod && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        void state.createTab('piflex://history');
        return;
      }
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        void state.createTab('piflex://downloads');
        return;
      }
      if (mod && e.key === ',') {
        e.preventDefault();
        state.setPanel('settings');
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void state.createTab('piflex://bookmarks');
        return;
      }
      // Ctrl+Shift+B: show/hide the bookmarks bar
      if (mod && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const visible = state.settingsData?.appearance.showBookmarksBar !== false;
        void state.updateSettings({ appearance: { showBookmarksBar: !visible } });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    // Web-content views forward browser-level shortcuts here because they own
    // keyboard focus while a page is displayed.
    const offForward = piflex.raw.on('browserShortcut', (payload) => {
      const data = payload as {
        key: string;
        code?: string;
        ctrlKey?: boolean;
        metaKey?: boolean;
        shiftKey?: boolean;
        altKey?: boolean;
      };
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: data.key,
          code: data.code,
          ctrlKey: !!data.ctrlKey,
          metaKey: !!data.metaKey,
          shiftKey: !!data.shiftKey,
          altKey: !!data.altKey,
          bubbles: true,
        }),
      );
    });
    return () => {
      window.removeEventListener('keydown', handler);
      offForward();
    };
  }, [enabled, store]);
}
