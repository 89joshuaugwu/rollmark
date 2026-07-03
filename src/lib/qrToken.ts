/**
 * Rotating QR token logic.
 *
 * The QR displayed on the lecturer's screen encodes {sessionId, token}.
 * The token rotates every 15s so a screenshot shared in a WhatsApp group
 * chat goes stale almost immediately — this is the core anti-proxy
 * mechanism for PERMISSIVE mode sessions (STRICT mode adds geofencing
 * on top of this).
 */

const ROTATION_MS = 15_000;

export function generateQrToken(): string {
  const bytes = new Uint8Array(9);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildAttendUrl(origin: string, sessionId: string, token: string): string {
  const url = new URL(`/attend/${sessionId}`, origin);
  url.searchParams.set("t", token);
  return url.toString();
}

export function msUntilNextRotation(qrTokenUpdatedAt: number): number {
  const elapsed = Date.now() - qrTokenUpdatedAt;
  return Math.max(0, ROTATION_MS - elapsed);
}

export const QR_ROTATION_MS = ROTATION_MS;
