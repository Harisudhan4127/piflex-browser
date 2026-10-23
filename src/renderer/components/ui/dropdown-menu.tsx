import * as React from 'react';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuPortal = DropdownPrimitive.Portal;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuSub = DropdownPrimitive.Sub;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, align = 'end', ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        'z-50 min-w-[220px] animate-scale-in overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1 shadow-2xl',
        className,
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { shortcut?: string; danger?: boolean }
>(({ className, children, shortcut, danger, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--color-surface-overlay)] data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]',
      className,
    )}
    {...props}
  >
    {children}
    {shortcut ? (
      <span className="ml-auto pl-4 text-[11px] tracking-wide text-[var(--color-text-subtle)]">{shortcut}</span>
    ) : null}
  </DropdownPrimitive.Item>
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--color-text)] outline-none data-[highlighted]:bg-[var(--color-surface-overlay)]',
      className,
    )}
    {...props}
  >
    <span className="flex h-4 w-4 items-center justify-center">
      <DropdownPrimitive.ItemIndicator>
        <Check size={14} className="text-accent" />
      </DropdownPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-[var(--color-border)]" />;
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
      {children}
    </div>
  );
}
