import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        'z-50 animate-scale-in rounded-md border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-2 py-1 text-[12px] text-[var(--color-text)] shadow-lg',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';

interface TooltipProps {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  shortcut?: string;
}
export function Tooltip({ label, children, side = 'bottom', shortcut }: TooltipProps) {
  return (
    <TooltipRoot delayDuration={400}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {shortcut ? <span className="ml-2 text-[var(--color-text-subtle)]">{shortcut}</span> : null}
      </TooltipContent>
    </TooltipRoot>
  );
}

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent };
