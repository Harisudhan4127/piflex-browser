import { useEffect, useState } from 'react';

export function ClockWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex select-none flex-col items-center">
      <div className="text-6xl font-light tracking-tight tabular-nums text-white drop-shadow-sm">
        {hh}
        <span className="mx-1 opacity-50">:</span>
        {mm}
      </div>
      <div className="mt-1 text-sm font-medium text-white/70">{date}</div>
    </div>
  );
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
