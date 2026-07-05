import "server-only";
import nodemailer from "nodemailer";
import { adminDb } from "@/lib/firebase-admin";
import { renderEmail, statRow } from "@/lib/server/emailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://rollmark.vercel.app";

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
  return snap.exists
    ? (snap.data() as { email: string; name: string; notifications: Record<string, boolean> })
    : null;
}

export async function sendSessionEndedEmail(
  lecturerId: string,
  session: { courseCode: string; courseName: string; studentsMarked: number }
) {
  const lecturer = await getLecturer(lecturerId);
  if (!lecturer || !lecturer.notifications?.sessionEndEmail) return;

  const html = renderEmail({
    previewText: `${session.studentsMarked} student${session.studentsMarked === 1 ? "" : "s"} marked present in ${session.courseCode}`,
    heading: `Session ended: ${session.courseCode}`,
    bodyHtml: `
      <p style="margin:0 0 4px;">Hi ${lecturer.name.split(" ")[0]},</p>
      <p style="margin:0;">
        Your attendance session for <strong>${session.courseCode} — ${session.courseName}</strong>
        just ended.
      </p>
      ${statRow([{ label: "Students marked", value: session.studentsMarked }])}
      <p style="margin:0; color:#6B7280; font-size:13px;">
        Head to your dashboard to review the full list, flag any suspicious entries, or export a
        CSV for your records.
      </p>
    `,
    button: { label: "View session records", href: `${APP_URL}/dashboard/records` },
  });

  await send(lecturer.email, `Session ended: ${session.courseCode}`, html);
}

export async function sendDuplicateDeviceAlert(
  lecturerId: string,
  info: { courseCode: string; regNumber: string }
) {
  const lecturer = await getLecturer(lecturerId);
  if (!lecturer || !lecturer.notifications?.duplicateDeviceAlert) return;

  const html = renderEmail({
    previewText: `Possible duplicate device flagged for ${info.regNumber} in ${info.courseCode}`,
    heading: "⚠️ Possible proxy attendance",
    bodyHtml: `
      <p style="margin:0 0 4px;">Hi ${lecturer.name.split(" ")[0]},</p>
      <p style="margin:0;">
        A device that already marked another student present in
        <strong>${info.courseCode}</strong> was just used to submit attendance for
        <strong>${info.regNumber}</strong>.
      </p>
      <p style="margin:16px 0 0; padding:12px 14px; background-color:#FFFBEB; border-left:3px solid #F59E0B; border-radius:6px; font-size:13px; color:#92400E;">
        This is a soft signal, not a hard block — review the flagged entry in your live session
        board before deciding whether to remove it.
      </p>
    `,
    button: { label: "Review live session", href: `${APP_URL}/dashboard` },
  });

  await send(lecturer.email, `⚠️ Possible proxy attendance in ${info.courseCode}`, html);
}

export async function sendWeeklySummaryEmail(
  lecturerId: string,
  stats: { totalSessions: number; totalStudentsMarked: number; avgAttendance: number | null }
) {
  const lecturer = await getLecturer(lecturerId);
  if (!lecturer || !lecturer.notifications?.weeklySummary) return;

  const html = renderEmail({
    previewText: `${stats.totalSessions} sessions, ${stats.totalStudentsMarked} students marked this week`,
    heading: "Your weekly RollMark summary",
    bodyHtml: `
      <p style="margin:0 0 4px;">Hi ${lecturer.name.split(" ")[0]},</p>
      <p style="margin:0;">Here's your attendance activity from the past 7 days:</p>
      ${statRow([
        { label: "Sessions run", value: stats.totalSessions },
        { label: "Students marked", value: stats.totalStudentsMarked },
        {
          label: "Avg. attendance",
          value: stats.avgAttendance !== null ? `${stats.avgAttendance}%` : "—",
        },
      ])}
      ${
        stats.avgAttendance === null
          ? `<p style="margin:0; color:#6B7280; font-size:13px;">
               Upload a course roster to unlock attendance-rate tracking.
             </p>`
          : ""
      }
    `,
    button: { label: "Open dashboard", href: `${APP_URL}/dashboard/analytics` },
  });

  await send(lecturer.email, "Your weekly RollMark summary", html);
}
