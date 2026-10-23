import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-8 w-full items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[13px] text-[var(--color-text)] outline-none transition-colors hover:border-[var(--color-border-strong)] focus:border-accent disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon>
      <ChevronDown size={14} className="text-[var(--color-text-subtle)]" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      collisionPadding={8}
      className={cn(
        'relative z-50 max-h-72 min-w-[10rem] animate-scale-in overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1 shadow-2xl',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--color-text)] outline-none data-[highlighted]:bg-[var(--color-surface-overlay)]',
      className,
    )}
    {...props}
  >
    <span className="flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check size={14} className="text-accent" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

export interface SimpleSelectOption {
  value: string;
  label: string;
}

/**
 * Convenience wrapper over the Radix select primitives for the common
 * value/label list case used throughout settings.
 */
export function SimpleSelect({
  value,
  onChange,
  options,
  className,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SimpleSelectOption[];
  className?: string;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('w-44', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
