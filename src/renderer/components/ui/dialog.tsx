import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title?: string }
>(({ className, children, title, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 animate-scale-in rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 shadow-2xl',
        className,
      )}
      {...props}
    >
      {title ? (
        <DialogPrimitive.Title className="mb-1 text-sm font-semibold text-[var(--color-text)]">
          {title}
        </DialogPrimitive.Title>
      ) : null}
      {children}
      <DialogPrimitive.Close
        aria-label="Close"
        className="absolute right-3 top-3 rounded-md p-1 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)]"
      >
        <X size={16} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[12px] leading-relaxed text-[var(--color-text-muted)]">{children}</p>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>;
}
