import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

const COOKIE_NAME = "rollmark_session";

/**
 * Next.js 16 renamed middleware.ts -> proxy.ts, and proxy runs on the
 * Node.js runtime by default (middleware was Edge-only). That means, unlike
 * the old middleware, this can fully verify the session cookie with
 * firebase-admin right here instead of doing a cheap presence check and
 * deferring real verification to `dashboard/layout.tsx`. The layout still
 * re-verifies too (defense in depth for direct server-side navigations),
 * but this is now the primary, fully-authoritative gate.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  let isValidSession = false;
  if (sessionCookie) {
    try {
      await adminAuth().verifySessionCookie(sessionCookie, true);
      isValidSession = true;
    } catch {
      isValidSession = false;
    }
  }

  if (pathname.startsWith("/dashboard") && !isValidSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/lecturer-login";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/auth") && isValidSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
