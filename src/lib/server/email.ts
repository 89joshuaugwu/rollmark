import "server-only";
import nodemailer from "nodemailer";
import { adminDb } from "@/lib/firebase-admin";

function getTransport() {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

async function send(to: string, subject: string, html: string) {
  const transport = getTransport();
  if (!transport) {
    // Don't crash the request that triggered this — email is a nice-to-have
    // notification, not core to attendance marking working correctly.
    console.warn("[email] GMAIL_SMTP_USER/GMAIL_SMTP_APP_PASSWORD not set, skipping send.");
    return;
  }
  await transport.sendMail({
    from: `"RollMark" <${process.env.GMAIL_SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

async function getLecturer(lecturerId: string) {
  const snap = await adminDb().collection("lecturers").doc(lecturerId).get();
  return snap.exists ? (snap.data() as { email: string; name: string; notifications: Record<string, boolean> }) : null;
}

export async function sendSessionEndedEmail(
  lecturerId: string,
  session: { courseCode: string; courseName: string; studentsMarked: number }
) {
  const lecturer = await getLecturer(lecturerId);
  if (!lecturer || !lecturer.notifications?.sessionEndEmail) return;

  await send(
    lecturer.email,
    `Session ended: ${session.courseCode}`,
    `<p>Hi ${lecturer.name},</p>
     <p>Your attendance session for <strong>${session.courseCode} — ${session.courseName}</strong> has ended.</p>
     <p><strong>${session.studentsMarked}</strong> student${session.studentsMarked === 1 ? "" : "s"} marked present.</p>
     <p>— RollMark</p>`
  );
}

export async function sendDuplicateDeviceAlert(
  lecturerId: string,
  info: { courseCode: string; regNumber: string }
) {
  const lecturer = await getLecturer(lecturerId);
  if (!lecturer || !lecturer.notifications?.duplicateDeviceAlert) return;

  await send(
    lecturer.email,
    `⚠️ Possible proxy attendance in ${info.courseCode}`,
    `<p>Hi ${lecturer.name},</p>
     <p>A device that already marked another student present in <strong>${info.courseCode}</strong>
     was just used to submit attendance for <strong>${info.regNumber}</strong>.</p>
     <p>Review the flagged entry in your live session ticker.</p>
     <p>— RollMark</p>`
  );
}

export async function sendWeeklySummaryEmail(
  lecturerId: string,
  stats: { totalSessions: number; totalStudentsMarked: number; avgAttendance: number | null }
) {
  const lecturer = await getLecturer(lecturerId);
  if (!lecturer || !lecturer.notifications?.weeklySummary) return;

  await send(
    lecturer.email,
    "Your weekly RollMark summary",
    `<p>Hi ${lecturer.name},</p>
     <p>Here's your attendance activity from the past 7 days:</p>
     <ul>
       <li>${stats.totalSessions} session${stats.totalSessions === 1 ? "" : "s"} run</li>
       <li>${stats.totalStudentsMarked} students marked present</li>
       <li>${stats.avgAttendance !== null ? `${stats.avgAttendance}% average attendance` : "Upload a roster to unlock attendance rates"}</li>
     </ul>
     <p>— RollMark</p>`
  );
}
