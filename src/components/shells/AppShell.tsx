"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarClock,
  BookOpen,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  ScanLine,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/Spinner";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/sessions/create", label: "Sessions", icon: CalendarClock },
  { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
  { href: "/dashboard/records", label: "Records", icon: ClipboardList },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// Bottom nav on mobile only shows 5 — analytics folds into Records tap-through
const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.label !== "Analytics");

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner label="Loading your dashboard..." />
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") router.replace("/auth/lecturer-login");
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner label="Redirecting to login..." />
      </div>
    );
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-bg text-white md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-slate-dark/40 md:flex md:flex-col">
        <div className="flex items-center gap-2 px-6 py-5">
          <ScanLine className="h-6 w-6 text-emerald" />
          <span className="text-lg font-bold">RollMark</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive(href)
                  ? "bg-emerald/15 text-emerald"
                  : "text-text-secondary hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/5 p-3">
          <div className="mb-2 truncate px-3 text-xs text-text-secondary">{profile?.email}</div>
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-rose/10 hover:text-rose"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-emerald" />
          <span className="font-bold">RollMark</span>
        </div>
        <button
          onClick={() => signOut()}
          aria-label="Log out"
          className="rounded-full p-2 text-text-secondary hover:bg-white/5"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/5 bg-slate-dark/95 backdrop-blur md:hidden">
        {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] ${
              isActive(href) ? "text-emerald" : "text-text-secondary"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
