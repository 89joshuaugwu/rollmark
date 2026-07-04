import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

const COOKIE_NAME = "rollmark_session";

/**
 * NOTE (2026-07): This was proxy.ts (Next.js 16's renamed middleware
 * convention). Reverted to middleware.ts because proxy.ts has an
 * unresolved Next.js 16 bug on Vercel where RSC prefetch requests
 * (?_rsc=...) and HEAD prefetches fall through to a static-file lookup
 * for the literal path instead of hitting the proxy, causing spurious
 * 500s on dynamic routes like /auth/lecturer-login and
 * /auth/lecturer-signup. See https://github.com/vercel/next.js/issues/87071.
 * The logic itself is unchanged from proxy.ts — only the filename and
 * function name changed, plus the explicit `runtime: "nodejs"` config
 * below, which middleware.ts needs opt-in for (proxy.ts got this for
 * free). Revert back to proxy.ts once Vercel/Next.js ship a fix upstream.
 */
export default async function middleware(request: NextRequest) {
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
  runtime: "nodejs",
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
