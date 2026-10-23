import { cn } from '@/lib/utils';

/**
 * PiFlex Browser brand mark: an original line-art glyph drawn for this project
 * (not derived from any other browser's assets).
 */
export function PiFlexLogo({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('text-accent', className)}
      aria-hidden="true"
    >
      <path
        d="M7.5 15.5a3 3 0 0 1 .3-5.98A4 4 0 0 1 15.4 8.6 3.2 3.2 0 0 1 16.2 15H7.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4 18.5h11M9.5 21h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
