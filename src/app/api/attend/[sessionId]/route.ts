import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { haversineMeters, parseNaijaDateTime } from "@/lib/utils";
import { sendDuplicateDeviceAlert } from "@/lib/server/email";
import type { AttendanceSession, SessionField } from "@/types";

export const runtime = "nodejs";

/**
 * Lazy expiry check — no cron needed for this. Every session access already
 * happens through a real HTTP request (a student scanning, a lecturer
 * viewing their board), so checking `endTime` right here, on the request
 * that's already happening, catches every case a periodic sweep would —
 * without needing Vercel Cron at all (which on the Hobby plan is capped at
 * once/day and fails deployment outright above that). Opportunistically
 * persists `status: "ended"` the first time anyone touches an expired
 * session, so it self-heals in the DB without a background job.
 */
async function endIfExpired(
  ref: FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>
): Promise<boolean> {
  if (data.status === "ended") return true;
  if (typeof data.endTime !== "string") return false;
  if (parseNaijaDateTime(data.endTime) > Date.now()) return false;
  await ref.update({ status: "ended" });
  return true;
}

// ---------- GET: sanitized session info for the public /attend page ----------

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const token = new URL(req.url).searchParams.get("t");

  const ref = adminDb().collection("sessions").doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ status: "invalid" });
  }

  const data = snap.data() as Record<string, unknown>;

  if (await endIfExpired(ref, data)) {
    return NextResponse.json({ status: "ended" });
  }
  if (token && data.qrToken !== token) {
    return NextResponse.json({ status: "expired" });
  }

  // Legacy-doc fallback — see the identical note in POST below.
  const requireGeofence =
    typeof data.requireGeofence === "boolean" ? data.requireGeofence : data.mode === "STRICT";

  return NextResponse.json({
    status: "ok",
    session: {
      id: snap.id,
      courseCode: data.courseCode,
      courseName: data.courseName,
      requireGeofence,
      fields: data.fields,
      geofence: data.geofence ?? null,
    },
  });
}

// ---------- POST: validate + record attendance ----------

interface SubmitBody {
  qrToken: string;
  regNumber?: string;
  firstName?: string;
  surname?: string;
  middleName?: string;
  phone?: string;
  email?: string;
  location?: { lat: number; lng: number; accuracy: number };
  fingerprint: string;
  [key: string]: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const { qrToken, location, fingerprint } = body;

  if (!fingerprint) {
    return NextResponse.json(
      { error: "Unable to identify this device. Please try again." },
      { status: 400 }
    );
  }

  const db = adminDb();
  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  const session = sessionSnap.data() as Record<string, unknown> & Omit<AttendanceSession, "id" | "requireGeofence">;
  // Legacy-doc fallback — pre-migration sessions have `mode` but no
  // `requireGeofence`; this is the authoritative server-side check, so it
  // must handle both shapes exactly like the client-side normalizer does.
  const requireGeofence =
    typeof session.requireGeofence === "boolean"
      ? session.requireGeofence
      : session.mode === "STRICT";

  // Validate against the session's actual field configuration rather than a
  // hard-coded list — a session can turn any of the default fields off, or
  // add custom fields, so "required" is whatever the lecturer configured.
  const fields: SessionField[] = Array.isArray(session.fields) ? session.fields : [];
  for (const field of fields) {
    if (field.requirement !== "required") continue;
    const value = body[field.key];
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: `${field.label} is required.` }, { status: 400 });
    }
  }

  const regNumber = typeof body.regNumber === "string" ? body.regNumber.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const surname = typeof body.surname === "string" ? body.surname.trim() : "";
  const middleName = typeof body.middleName === "string" ? body.middleName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (await endIfExpired(sessionRef, session)) {
    return NextResponse.json({ error: "This session has ended." }, { status: 409 });
  }

  // 1. QR token check — the client's token must match what's currently live.
  if (qrToken !== session.qrToken) {
    return NextResponse.json(
      { error: "This QR code has expired. Ask your lecturer to refresh and scan again." },
      { status: 409 }
    );
  }

  // 2. Geofence check (only when requireGeofence is on) — authoritative.
  // The client-side distance readout is UX feedback only; this is the real gate.
  let distanceFromLecturerMeters: number | null = null;
  if (requireGeofence && session.geofence) {
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      return NextResponse.json(
        { error: "Location required for this session. Enable it in your browser settings." },
        { status: 400 }
      );
    }
    distanceFromLecturerMeters = haversineMeters(location, session.geofence.center);
    if (distanceFromLecturerMeters > session.geofence.radiusMeters) {
      return NextResponse.json(
        {
          error: `You are ${Math.round(distanceFromLecturerMeters)}m away. Move closer.`,
          distance: distanceFromLecturerMeters,
        },
        { status: 403 }
      );
    }
  }

  const normalizedReg = regNumber.toUpperCase();

  // 3. Roster validation — only enforced once a roster has been uploaded.
  const courseSnap = await db.collection("courses").doc(session.courseId).get();
  const rosterCount = (courseSnap.data()?.rosterCount as number | undefined) ?? 0;
  if (rosterCount > 0) {
    if (!normalizedReg) {
      return NextResponse.json(
        {
          error:
            "Registration number is required for this course because a student roster has been uploaded.",
        },
        { status: 400 }
      );
    }
    const rosterEntry = await db
      .collection("courses")
      .doc(session.courseId)
      .collection("roster")
      .doc(normalizedReg)
      .get();
    if (!rosterEntry.exists) {
      return NextResponse.json({ error: "Registration number not recognized." }, { status: 403 });
    }
  }

  // 4. Record ID. A deterministic `${sessionId}_${normalizedReg}` ID gives
  // free atomic dedup via create()'s ALREADY_EXISTS — but only holds when
  // regNumber is guaranteed present. Since fields (including Reg Number)
  // can be turned off per session, there's no guaranteed unique identifier
  // to key on in the general case, so we fall back to an auto-ID whenever
  // regNumber isn't collected. Duplicate prevention in that case relies on
  // the fingerprint soft-flag below instead of a hard block.
  const recordRef = normalizedReg
    ? db.collection("attendanceRecords").doc(`${sessionId}_${normalizedReg}`)
    : db.collection("attendanceRecords").doc();

  // 5. Fingerprint fraud flag (soft — log/flag, don't block).
  const deviceQuery = await db
    .collection("attendanceRecords")
    .where("sessionId", "==", sessionId)
    .where("deviceFingerprint", "==", fingerprint)
    .limit(1)
    .get();
  const flagged = !deviceQuery.empty;

  try {
    await recordRef.create({
      sessionId,
      lecturerId: session.lecturerId,
      courseCode: session.courseCode,
      regNumber: normalizedReg,
      firstName,
      surname,
      middleName,
      phone,
      email,
      location: location ?? null,
      distanceFromLecturerMeters,
      deviceFingerprint: fingerprint,
      flagged,
      flagReason: flagged ? "Device already used for another student in this session" : "",
      markedManually: false,
      submittedAt: Date.now(),
    });
  } catch (err: unknown) {
    // Firestore gRPC ALREADY_EXISTS status code.
    const code = (err as { code?: number })?.code;
    if (code === 6) {
      return NextResponse.json(
        { error: "You've already marked attendance for this session." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  await sessionRef.update({ studentsMarked: FieldValue.increment(1) });

  if (flagged) {
    sendDuplicateDeviceAlert(session.lecturerId, {
      courseCode: session.courseCode,
      regNumber: normalizedReg,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, flagged });
}
