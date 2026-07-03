"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listSessions } from "@/lib/firestore";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { SessionCard } from "@/components/molecules/SessionCard";
import { timeAgo } from "@/lib/utils";
import type { AttendanceSession } from "@/types";

export default function DashboardHomePage() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    listSessions(user.uid)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [user]);

  const active = sessions.filter((s) => s.status === "active");
  const recent = sessions.filter((s) => s.status === "ended").slice(0, 5);

  const thisMonth = sessions.filter(
    (s) => new Date(s.createdAt).getMonth() === new Date(now).getMonth()
  );
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const studentsThisWeek = sessions
    .filter((s) => s.createdAt >= weekAgo)
    .reduce((sum, s) => sum + s.studentsMarked, 0);
  const avgAttendance =
    sessions.length > 0
      ? Math.round(
          (sessions.reduce((sum, s) => sum + s.studentsMarked, 0) / sessions.length) * 10
        ) / 10
      : 0;

  return (
    <div className="relative pb-16">
      <h1 className="text-2xl font-bold">
        {profile?.name ? `Welcome back, ${profile.name.split(" ")[0]}` : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        Here&apos;s what&apos;s happening with your attendance sessions.
      </p>

      {loading ? (
        <Spinner label="Loading dashboard..." />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-text-secondary">Sessions this month</p>
              <p className="mt-1 text-2xl font-bold text-white">{thisMonth.length}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Students marked this week</p>
              <p className="mt-1 text-2xl font-bold text-white">{studentsThisWeek}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Avg. attendance / session</p>
              <p className="mt-1 text-2xl font-bold text-white">{avgAttendance}</p>
            </Card>
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-text-secondary">Active sessions</h2>
            {active.length === 0 ? (
              <Card className="text-center text-sm text-text-secondary">
                No sessions live right now.{" "}
                <Link href="/dashboard/sessions/create" className="text-emerald">
                  Create one
                </Link>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {active.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-secondary">Recent activity</h2>
              <Link href="/dashboard/records" className="text-xs text-emerald">
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-text-secondary">Nothing here yet.</p>
            ) : (
              <div className="space-y-2">
                {recent.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/40 px-3 py-2.5 text-sm"
                  >
                    <span className="text-white">
                      {s.studentsMarked} students marked in {s.courseCode}
                    </span>
                    <span className="shrink-0 text-xs text-text-secondary">
                      {timeAgo(s.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Link
        href="/dashboard/sessions/create"
        aria-label="Create session"
        className="fixed bottom-20 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald text-slate-950 shadow-lg transition-transform hover:scale-105 md:bottom-8 md:right-8"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
