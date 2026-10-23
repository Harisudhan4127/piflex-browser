export interface ContextMenuEntry {
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

/**
 * Lightweight DOM-based context menu. Kept local to the renderer because these
 * affordances never need to reach the main process. Returns a promise that
 * resolves once the menu closes.
 */
export function contextMenu(event: { clientX: number; clientY: number }, entries: ContextMenuEntry[]): Promise<void> {
  return new Promise((resolve) => {
    const existing = document.getElementById('piflex-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'piflex-context-menu';
    Object.assign(menu.style, {
      position: 'fixed',
      zIndex: '1000',
      minWidth: '180px',
      padding: '4px',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface-elevated)',
      boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
      fontSize: '13px',
    } as CSSStyleDeclaration);

    const close = () => {
      menu.remove();
      document.removeEventListener('mousedown', onDocDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', close);
      resolve();
    };

    const onDocDown = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    for (const entry of entries) {
      if (entry.separator) {
        const sep = document.createElement('div');
        Object.assign(sep.style, {
          height: '1px',
          margin: '4px 2px',
          background: 'var(--color-border)',
        } as CSSStyleDeclaration);
        menu.appendChild(sep);
        continue;
      }
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = entry.label ?? '';
      item.disabled = Boolean(entry.disabled);
      Object.assign(item.style, {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '6px 10px',
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        color: entry.danger ? 'var(--color-danger)' : 'var(--color-text)',
        cursor: entry.disabled ? 'default' : 'pointer',
        opacity: entry.disabled ? '0.5' : '1',
      } as CSSStyleDeclaration);
      if (!entry.disabled) {
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--color-surface-overlay)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'transparent';
        });
        item.addEventListener('click', () => {
          entry.onClick?.();
          close();
        });
      }
      menu.appendChild(item);
    }

    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    const x = Math.min(event.clientX, window.innerWidth - rect.width - 8);
    const y = Math.min(event.clientY, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.max(8, x)}px`;
    menu.style.top = `${Math.max(8, y)}px`;

    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', close);
  });
}
