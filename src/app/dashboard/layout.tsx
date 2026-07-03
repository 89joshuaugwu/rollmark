import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase-admin";
import { AppShell } from "@/components/shells/AppShell";

export const runtime = "nodejs";

async function requireSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("rollmark_session")?.value;

  if (!sessionCookie) redirect("/auth/lecturer-login");

  try {
    // `true` = check the session hasn't been revoked (e.g. password change).
    await adminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    redirect("/auth/lecturer-login");
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <AppShell>{children}</AppShell>;
}
