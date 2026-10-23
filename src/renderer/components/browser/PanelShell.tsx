import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PanelShell({
  title,
  children,
  onClose,
  wide,
  headerActions,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  headerActions?: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-30 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/40"
      />
      <aside
        className={cn(
          'animate-scale-in relative flex h-full flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-2xl',
          wide ? 'w-[520px]' : 'w-[380px]',
        )}
        role="dialog"
        aria-label={title}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          <div className="flex items-center gap-1">
            {headerActions}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]"
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-overlay)] text-[var(--color-text-subtle)]">
        {icon}
      </span>
      <div className="text-[13px] font-medium text-[var(--color-text)]">{title}</div>
      {hint ? <div className="max-w-[260px] text-[12px] text-[var(--color-text-subtle)]">{hint}</div> : null}
    </div>
  );
}
