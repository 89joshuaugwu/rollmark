"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { getSession, subscribeToRecords } from "@/lib/firestore";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StudentRow, StudentTableRow } from "@/components/molecules/StudentRow";
import { formatDate, formatTime } from "@/lib/utils";
import type { AttendanceRecord, AttendanceSession } from "@/types";

function toCsv(records: AttendanceRecord[]): string {
  const header = ["Reg Number", "Surname", "First Name", "Phone", "Email", "Submitted At", "Flagged"];
  const rows = records.map((r) => [
    r.regNumber,
    r.surname,
    r.firstName,
    r.phone ?? "",
    r.email ?? "",
    new Date(r.submittedAt).toISOString(),
    r.flagged ? "Yes" : "No",
  ]);
  return [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
}

export default function SessionHistoryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession(sessionId)
      .then(setSession)
      .finally(() => setLoading(false));
    const unsub = subscribeToRecords(sessionId, setRecords);
    return () => unsub();
  }, [sessionId]);

  const downloadCsv = () => {
    const csv = toCsv(records);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session?.courseCode ?? "session"}-${session?.date ?? ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner label="Loading session history..." />;
  if (!session) return <p className="text-sm text-text-secondary">Session not found.</p>;

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {session.courseCode} — {session.courseName}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {formatDate(session.date)} · {formatTime(session.startTime)}–
            {formatTime(session.endTime)} · {records.length} students marked
          </p>
        </div>
        <Badge status="ended">Ended</Badge>
      </div>

      <Button variant="secondary" onClick={downloadCsv} className="mb-5">
        <Download className="h-4 w-4" />
        Export as CSV
      </Button>

      {records.length === 0 ? (
        <p className="text-sm text-text-secondary">No students marked in this session.</p>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {records.map((r) => (
              <StudentRow key={r.id} record={r} />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-lg border border-white/5 md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-slate-800/50 text-left text-xs text-text-secondary">
                  <th className="px-3 py-2.5 font-medium">Reg Number</th>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Course</th>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <StudentTableRow key={r.id} record={r} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
