"use server";

import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { generateQrToken } from "@/lib/qrToken";
import { sendSessionEndedEmail } from "@/lib/server/email";
import type { GeoPoint } from "@/types";

/**
 * admin SDK writes bypass Firestore security rules entirely, so the
 * ownership check that `isOwner(resource.data.lecturerId)` would normally
 * enforce has to be done by hand here instead — otherwise any signed-in
 * lecturer could rotate/end another lecturer's session.
 */
async function requireOwnedSession(sessionId: string) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("rollmark_session")?.value;
  if (!sessionCookie) throw new Error("Not authenticated.");

  const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
  const ref = adminDb().collection("sessions").doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Session not found.");

  const data = snap.data()!;
  if (data.lecturerId !== decoded.uid) throw new Error("Not authorized.");

  return { ref, data };
}

export async function rotateQrTokenAction(sessionId: string) {
  const { ref } = await requireOwnedSession(sessionId);
  await ref.update({ qrToken: generateQrToken(), qrTokenUpdatedAt: Date.now() });
}

export async function updateGeofenceAction(
  sessionId: string,
  geofence: { center: GeoPoint; radiusMeters: number }
) {
  const { ref } = await requireOwnedSession(sessionId);
  await ref.update({ geofence });
}

/**
 * Turns geofencing on/off for a session that's already been created —
 * SessionCreationForm only sets this at creation time, with no edit path
 * afterward. This lets a lecturer who started a session without it (then
 * realized they wanted it) add it mid-class without ending and recreating
 * the whole session, losing whatever attendance was already marked.
 * Turning it off intentionally leaves any previously-captured `geofence`
 * in place (untouched) so re-enabling later doesn't require recapturing
 * location — pass a new `geofence` alongside `requireGeofence: true` only
 * when actually changing/setting the location.
 */
export async function setRequireGeofenceAction(
  sessionId: string,
  requireGeofence: boolean,
  geofence?: { center: GeoPoint; radiusMeters: number }
) {
  const { ref } = await requireOwnedSession(sessionId);
  await ref.update({
    requireGeofence,
    ...(geofence !== undefined ? { geofence } : {}),
  });
}

export async function endSessionAction(sessionId: string) {
  const { ref, data } = await requireOwnedSession(sessionId);
  await ref.update({ status: "ended" });

  sendSessionEndedEmail(data.lecturerId, {
    courseCode: data.courseCode,
    courseName: data.courseName,
    studentsMarked: data.studentsMarked ?? 0,
  }).catch(() => {});
}
