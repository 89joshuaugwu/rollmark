"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getAllRecordsForLecturer, getCourses } from "@/lib/firestore";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { StudentRow, StudentTableRow } from "@/components/molecules/StudentRow";
import type { AttendanceRecord, Course } from "@/types";

function toCsv(records: AttendanceRecord[]): string {
  const header = ["Reg Number", "Surname", "First Name", "Course", "Submitted At", "Flagged"];
  const rows = records.map((r) => [
    r.regNumber,
    r.surname,
    r.firstName,
    r.courseCode,
    new Date(r.submittedAt).toISOString(),
    r.flagged ? "Yes" : "No",
  ]);
  return [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
}

export default function RecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    Promise.all([getAllRecordsForLecturer(user.uid), getCourses(user.uid)]).then(
      ([recs, cs]) => {
        setRecords(recs);
        setCourses(cs);
        setLoading(false);
      }
    );
  }, [user]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (courseFilter !== "all" && r.courseCode !== courseFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.regNumber.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        r.surname.toLowerCase().includes(q)
      );
    });
  }, [records, search, courseFilter]);

  const downloadCsv = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rollmark-records.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Records</h1>
        <Button variant="secondary" onClick={downloadCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" />
          Export all
        </Button>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            placeholder="Search by reg number or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="sm:w-56">
          <option value="all">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.code}>
              {c.code}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner label="Loading records..." />
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-secondary">No records match your search.</p>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {filtered.map((r) => (
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
                {filtered.map((r) => (
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
