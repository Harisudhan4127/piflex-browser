import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024)
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(ts);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function friendlyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "piflex:") return "New Tab";
    const host = parsed.hostname.replace(/^www\./, "");
    const rest =
      (parsed.pathname === "/" ? "" : parsed.pathname) + parsed.search;
    return host + rest;
  } catch {
    return url;
  }
}

export function groupHistoryByDay<T extends { lastVisit: number }>(
  entries: T[],
): { label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const entry of entries) {
    const date = new Date(entry.lastVisit);
    date.setHours(0, 0, 0, 0);
    let label: string;
    if (date.getTime() === today.getTime()) label = "Today";
    else if (date.getTime() === yesterday.getTime()) label = "Yesterday";
    else {
      label = date.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
    const bucket = groups.get(label);
    if (bucket) bucket.push(entry);
    else groups.set(label, [entry]);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}
