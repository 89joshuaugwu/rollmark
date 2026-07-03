"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getCourses, listSessions, getAllRecordsForLecturer } from "@/lib/firestore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { AttendanceRecord, AttendanceSession, Course } from "@/types";

interface AtRiskStudent {
  regNumber: string;
  name: string;
  courseCode: string;
  attended: number;
  total: number;
  pct: number;
}

function isoWeekLabel(ts: number): string {
  const d = new Date(ts);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `Wk ${week}`;
}

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      listSessions(user.uid, { max: 200 }),
      getCourses(user.uid),
      getAllRecordsForLecturer(user.uid, { max: 2000 }),
    ]).then(([s, c, r]) => {
      setSessions(s);
      setCourses(c);
      setRecords(r);
      setLoading(false);
    });
  }, [user]);

  const totalStudentsMarked = records.length;

  const avgAttendanceRate = useMemo(() => {
    const withRoster = sessions
      .map((s) => {
        const course = courses.find((c) => c.id === s.courseId);
        if (!course || course.rosterCount === 0) return null;
        return (s.studentsMarked / course.rosterCount) * 100;
      })
      .filter((v): v is number => v !== null);
    if (withRoster.length === 0) return null;
    return Math.round((withRoster.reduce((a, b) => a + b, 0) / withRoster.length) * 10) / 10;
  }, [sessions, courses]);

  const trendData = useMemo(() => {
    const byWeek = new Map<string, { total: number; count: number }>();
    sessions.forEach((s) => {
      const course = courses.find((c) => c.id === s.courseId);
      if (!course || course.rosterCount === 0) return;
      const label = isoWeekLabel(s.createdAt);
      const pct = (s.studentsMarked / course.rosterCount) * 100;
      const entry = byWeek.get(label) ?? { total: 0, count: 0 };
      entry.total += pct;
      entry.count += 1;
      byWeek.set(label, entry);
    });
    return Array.from(byWeek.entries())
      .map(([week, { total, count }]) => ({ week, attendance: Math.round(total / count) }))
      .slice(-8);
  }, [sessions, courses]);

  const atRiskStudents: AtRiskStudent[] = useMemo(() => {
    const result: AtRiskStudent[] = [];
    courses.forEach((course) => {
      const courseSessions = sessions.filter((s) => s.courseId === course.id);
      if (courseSessions.length === 0) return;
      const courseRecords = records.filter((r) => r.courseCode === course.code);

      const byStudent = new Map<string, { name: string; count: number }>();
      courseRecords.forEach((r) => {
        const key = r.regNumber;
        const entry = byStudent.get(key) ?? { name: `${r.surname} ${r.firstName}`, count: 0 };
        entry.count += 1;
        byStudent.set(key, entry);
      });

      if (course.rosterCount === 0 || courseSessions.length < 2) return;

      byStudent.forEach((v, regNumber) => {
        const pct = (v.count / courseSessions.length) * 100;
        if (pct < 75) {
          result.push({
            regNumber,
            name: v.name,
            courseCode: course.code,
            attended: v.count,
            total: courseSessions.length,
            pct: Math.round(pct),
          });
        }
      });
    });
    return result.sort((a, b) => a.pct - b.pct);
  }, [courses, sessions, records]);

  if (loading) return <Spinner label="Crunching your attendance data..." />;

  return (
    <div id="analytics-report">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance analytics</h1>
        <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
          <Printer className="h-4 w-4" />
          Download report
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-text-secondary">Total sessions</p>
          <p className="mt-1 text-2xl font-bold text-white">{sessions.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Students marked overall</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalStudentsMarked}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Avg. attendance rate</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {avgAttendanceRate !== null ? `${avgAttendanceRate}%` : "—"}
          </p>
          {avgAttendanceRate === null && (
            <p className="mt-0.5 text-[11px] text-text-secondary">
              Upload a roster to your courses to unlock this
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <h3 className="mb-3 text-sm font-semibold text-white">Attendance by week</h3>
        {trendData.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-secondary">
            Not enough data yet — run a few sessions with a roster uploaded.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "#1E293B",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="attendance"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10B981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="mt-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber" />
          <h3 className="text-sm font-semibold text-white">
            {atRiskStudents.length} student{atRiskStudents.length === 1 ? "" : "s"} below 75%
            attendance
          </h3>
        </div>
        {atRiskStudents.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No at-risk students detected yet, or not enough sessions have run.
          </p>
        ) : (
          <div className="space-y-2">
            {atRiskStudents.map((s) => (
              <div
                key={`${s.courseCode}-${s.regNumber}`}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/50 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-white">{s.name}</p>
                  <p className="text-xs text-text-secondary">
                    {s.regNumber} · {s.courseCode}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-rose">
                  {s.attended}/{s.total} · {s.pct}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
