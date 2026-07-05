import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { parseNaijaDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Triggered by Vercel Cron (see vercel.json). Same auth pattern as
 * weekly-summary: Vercel sends `Authorization: Bearer ${CRON_SECRET}`
 * automatically when CRON_SECRET is set as an env var.
 *
 * This is the authoritative backstop for auto-ending expired sessions —
 * LiveSessionBoard.tsx also does this client-side the instant a lecturer
 * with the board open crosses endTime, but that only fires if someone
 * actually has the tab open. This cron catches every other case (lecturer
 * closed the tab, session had no geofence/dashboard visit near the end
 * time, etc.) so a session's `status` never silently drifts from reality.
 *
 * NOTE ON FREQUENCY: Vercel's Hobby (free) plan limits cron jobs to once
 * per day regardless of the schedule string you set — it will silently
 * only fire once daily even if this says every 5 minutes. On Hobby, this
 * means an expired session could show as "active" for up to ~24h if no
 * lecturer has the board open to trigger the client-side auto-end. If that
 * gap matters, either upgrade to a paid Vercel plan for true 5-minute
 * cron, or rely on the client-side check being "good enough" day-to-day.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const now = Date.now();

  const activeSnap = await db.collection("sessions").where("status", "==", "active").get();

  let ended = 0;
  const batch = db.batch();

  activeSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (typeof data.endTime !== "string") return;
    if (parseNaijaDateTime(data.endTime) <= now) {
      batch.update(doc.ref, { status: "ended" });
      ended++;
    }
  });

  if (ended > 0) await batch.commit();

  return NextResponse.json({ success: true, sessionsEnded: ended, checked: activeSnap.size });
}
