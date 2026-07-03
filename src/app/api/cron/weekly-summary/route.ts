import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendWeeklySummaryEmail } from "@/lib/server/email";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Triggered by Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically when CRON_SECRET is
 * set as an env var — this checks that header so the endpoint can't be
 * triggered by anyone who finds the URL.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const lecturersSnap = await db
    .collection("lecturers")
    .where("notifications.weeklySummary", "==", true)
    .get();

  let sent = 0;

  for (const lecturerDoc of lecturersSnap.docs) {
    const lecturerId = lecturerDoc.id;

    const [sessionsSnap, coursesSnap] = await Promise.all([
      db
        .collection("sessions")
        .where("lecturerId", "==", lecturerId)
        .where("createdAt", ">=", weekAgo)
        .get(),
      db.collection("courses").where("lecturerId", "==", lecturerId).get(),
    ]);

    if (sessionsSnap.empty) continue; // don't email lecturers with no activity this week

    const coursesById = new Map(coursesSnap.docs.map((d) => [d.id, d.data()]));

    let totalStudentsMarked = 0;
    const attendanceRates: number[] = [];

    sessionsSnap.docs.forEach((s) => {
      const data = s.data();
      totalStudentsMarked += data.studentsMarked ?? 0;
      const course = coursesById.get(data.courseId);
      if (course && course.rosterCount > 0) {
        attendanceRates.push((data.studentsMarked / course.rosterCount) * 100);
      }
    });

    const avgAttendance =
      attendanceRates.length > 0
        ? Math.round((attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length) * 10) / 10
        : null;

    await sendWeeklySummaryEmail(lecturerId, {
      totalSessions: sessionsSnap.size,
      totalStudentsMarked,
      avgAttendance,
    });
    sent++;
  }

  return NextResponse.json({ success: true, lecturersEmailed: sent });
}
