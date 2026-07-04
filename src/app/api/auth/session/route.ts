import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const COOKIE_NAME = "rollmark_session";
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    // Verifying first gives a clean 401 instead of a confusing cookie error
    // if the client ever sends a stale/garbage token.
    await adminAuth().verifyIdToken(idToken);

    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: FOURTEEN_DAYS_MS,
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, sessionCookie, {
      maxAge: FOURTEEN_DAYS_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return res;
  } catch (err) {
    // Logged server-side only — client still gets the generic message.
    // Vercel Function Logs for /api/auth/session will now show the real
    // Firebase Admin error (bad private key, project ID mismatch, clock
    // skew, etc.) instead of just "Could not create session".
    console.error("[/api/auth/session] session cookie creation failed:", err);
    return NextResponse.json({ error: "Could not create session" }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
