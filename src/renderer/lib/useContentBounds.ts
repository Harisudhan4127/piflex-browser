import { useEffect, useRef } from 'react';
import { piflex } from '@/lib/api';

/**
 * Measures the browser-content viewport (everything below the chrome) and
 * reports its rectangle to the main process, which positions the active
 * WebContentsView there. Uses a ResizeObserver so resizing and chrome height
 * changes both keep the web view aligned.
 *
 * `reservedRight` shrinks the reported width when a native overlay panel is
 * open, because WebContentsViews render above the React shell and would
 * otherwise cover the panel.
 */
export function useContentBounds(
  enabled: boolean,
  reservedRight = 0,
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    let frame = 0;
    const report = () => {
      const rect = element.getBoundingClientRect();
      const payload = {
        bounds: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.max(0, Math.round(rect.width - reservedRight)),
          height: Math.round(rect.height),
        },
      };
      piflex.raw.send('layoutSetToolbarHeight', payload);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(report);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, reservedRight]);

  return ref;
}
