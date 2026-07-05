import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatTime(iso: string | number): string {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | number): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Session `date`/`startTime`/`endTime` fields are stored as naive
 * datetime strings (e.g. "2026-07-05T23:00:00") with no timezone offset —
 * built straight from a lecturer's <input type="date"/"time"> in their
 * browser, which is always Nigeria (WAT, UTC+1, no DST).
 *
 * Parsing a naive ISO string with `new Date(...)` is NOT safe across
 * environments: browsers interpret it as the user's local time (correct,
 * since the lecturer IS in Nigeria), but Vercel's serverless functions run
 * in UTC — so the same string parsed server-side (e.g. in a cron job)
 * would be off by exactly one hour. Explicitly appending the WAT offset
 * makes the parse correct regardless of which environment runs it.
 */
export function parseNaijaDateTime(naive: string): number {
  const hasOffset = /[+-]\d{2}:\d{2}$|Z$/.test(naive);
  return new Date(hasOffset ? naive : `${naive}+01:00`).getTime();
}
