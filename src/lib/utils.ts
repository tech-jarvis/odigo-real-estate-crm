import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact currency for tight UI surfaces, e.g. $2.9M — uses custom logic to avoid Node/browser ICU divergence. */
export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : parseFloat(v.toFixed(1))}M`;
  }
  if (value >= 1_000) {
    const v = value / 1_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : parseFloat(v.toFixed(1))}K`;
  }
  return `$${value}`;
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeTime(date: string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

/** Days from today until the given date (negative if past). */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 1)
    .join("")
    .toUpperCase();
}
