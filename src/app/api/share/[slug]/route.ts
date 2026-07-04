import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { haversineMeters } from "@/lib/utils";
import type { AttendanceSession, Course } from "@/types";

export const runtime = "nodejs";

/**
 * GET /api/share/[slug]?lat=..&lng=..
 *
 * Public, unauthenticated — this is what the static share page (`/s/[slug]`)
 * polls. It deliberately returns the same generic "out_of_range" status
 * whether the slug's course exists but is out of range, or the caller
 * omitted location entirely — never anything that would let someone probe
 * whether a given slug/course exists from off-campus.
 *
 * This route uses the Admin SDK, bypassing Firestore rules entirely — same
 * architecture as /api/attend/[sessionId]. Students/course reps never touch
 * Firestore directly.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const latStr = url.searchParams.get("lat");
  const lngStr = url.searchParams.get("lng");

  const db = adminDb();
  const courseQuery = await db
    .collection("courses")
    .where("shareSlug", "==", slug)
    .limit(1)
    .get();

  if (courseQuery.empty) {
    return NextResponse.json({ status: "invalid" });
  }

  const courseDoc = courseQuery.docs[0];
  const course = courseDoc.data() as Omit<Course, "id">;

  if (course.shareGeofenceEnabled && course.shareGeofence) {
    const lat = latStr !== null ? Number(latStr) : NaN;
    const lng = lngStr !== null ? Number(lngStr) : NaN;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ status: "location_required" });
    }

    const distance = haversineMeters({ lat, lng }, course.shareGeofence.center);
    if (distance > course.shareGeofence.radiusMeters) {
      // Deliberately generic — see the note above.
      return NextResponse.json({ status: "out_of_range" });
    }
  }

  // NOTE: this composite query (courseId ==, status ==, orderBy createdAt)
  // requires a Firestore composite index. On first deploy, Firestore will
  // throw a "the query requires an index" error with a direct console link
  // in the error message the first time this runs — click that link and
  // publish the suggested index (courseId Asc, status Asc, createdAt Desc).
  // This is the same "must be done manually in Firebase Console" category
  // as publishing firestore.rules — it will not work until that's done.
  const sessionQuery = await db
    .collection("sessions")
    .where("courseId", "==", courseDoc.id)
    .where("status", "==", "active")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (sessionQuery.empty) {
    return NextResponse.json({
      status: "no_session",
      courseCode: course.code,
      courseName: course.name,
    });
  }

  const sessionDoc = sessionQuery.docs[0];
  const session = sessionDoc.data() as Omit<AttendanceSession, "id">;

  return NextResponse.json({
    status: "ok",
    session: {
      id: sessionDoc.id,
      qrToken: session.qrToken,
      qrTokenUpdatedAt: session.qrTokenUpdatedAt,
      courseCode: session.courseCode,
      courseName: session.courseName,
    },
  });
}
