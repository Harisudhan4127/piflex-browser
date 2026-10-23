import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] outline-none transition-colors focus:border-accent',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
