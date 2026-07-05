"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { getSession, subscribeToRecords, flagAttendanceRecord, unflagAttendanceRecord } from "@/lib/firestore";
import { exportSessionRecordsPdf } from "@/lib/pdfExport";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatTime, timeAgo } from "@/lib/utils";
import type { AttendanceRecord, AttendanceSession } from "@/types";

function toCsv(records: AttendanceRecord[]): string {
  return Papa.unparse(
    records.map((r) => ({
      "Reg Number": r.regNumber,
      Surname: r.surname,
      "First Name": r.firstName,
      Phone: r.phone ?? "",
      Email: r.email ?? "",
      "Submitted At": new Date(r.submittedAt).toISOString(),
      Flagged: r.flagged ? "Yes" : "No",
    }))
  );
}

export default function SessionHistoryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { user } = useAuth();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession(sessionId)
      .then(setSession)
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRecords(sessionId, user.uid, setRecords);
    return () => unsub();
  }, [sessionId, user]);

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

  const downloadPdf = () => {
    if (!session) return;
    exportSessionRecordsPdf({
      courseCode: session.courseCode,
      courseName: session.courseName,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      records,
    });
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

      <div className="mb-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={downloadCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button variant="secondary" onClick={downloadPdf}>
          <FileText className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-text-secondary">No students marked in this session.</p>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 md:hidden">
            {records.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/5 bg-slate-800/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-white">
                    {r.surname} {r.firstName}
                  </p>
                  <Badge status={r.flagged ? "flagged" : "success"}>
                    {r.flagged ? "Flagged" : "Present"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text-secondary">Reg: {r.regNumber}</p>
                <p className="text-xs text-text-secondary">
                  {formatDate(r.submittedAt)} · {formatTime(r.submittedAt)} · {timeAgo(r.submittedAt)}
                </p>
                {r.flagged ? (
                  <button
                    onClick={() => unflagAttendanceRecord(r.id)}
                    className="mt-2 min-h-[36px] text-xs text-emerald hover:underline"
                  >
                    Remove flag
                  </button>
                ) : (
                  <button
                    onClick={() => flagAttendanceRecord(r.id, "Flagged by lecturer")}
                    className="mt-2 min-h-[36px] text-xs text-amber hover:underline"
                  >
                    Flag as proxy
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-lg border border-white/5 md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-slate-800/50 text-left text-xs text-text-secondary">
                  <th className="px-3 py-2.5 font-medium">Reg Number</th>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Time</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 text-sm">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-text-secondary">
                      {r.regNumber}
                    </td>
                    <td className="px-3 py-2.5 text-white">
                      {r.surname} {r.firstName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-text-secondary">
                      {formatTime(r.submittedAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge status={r.flagged ? "flagged" : "success"}>
                        {r.flagged ? "Flagged" : "Present"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.flagged ? (
                        <button
                          onClick={() => unflagAttendanceRecord(r.id)}
                          className="text-xs text-emerald hover:underline"
                        >
                          Remove flag
                        </button>
                      ) : (
                        <button
                          onClick={() => flagAttendanceRecord(r.id, "Flagged by lecturer")}
                          className="text-xs text-amber hover:underline"
                        >
                          Flag as proxy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
