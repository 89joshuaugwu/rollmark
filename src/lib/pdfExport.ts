import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatTime } from "@/lib/utils";
import type { AttendanceRecord } from "@/types";

export function exportSessionRecordsPdf(opts: {
  courseCode: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  records: AttendanceRecord[];
}) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("RollMark — Attendance Report", 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`${opts.courseCode} — ${opts.courseName}`, 14, 27);
  doc.text(
    `${formatDate(opts.date)} · ${formatTime(opts.startTime)}–${formatTime(opts.endTime)} · ${opts.records.length} students marked`,
    14,
    33
  );

  autoTable(doc, {
    startY: 40,
    head: [["Reg Number", "Name", "Phone", "Email", "Time", "Status"]],
    body: opts.records.map((r) => [
      r.regNumber,
      `${r.surname} ${r.firstName}`,
      r.phone || "—",
      r.email || "—",
      formatTime(r.submittedAt),
      r.flagged ? "Flagged" : "Present",
    ]),
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 9 },
  });

  doc.save(`${opts.courseCode}-${opts.date}-attendance.pdf`);
}

export function exportAnalyticsPdf(opts: {
  totalSessions: number;
  totalStudentsMarked: number;
  avgAttendanceRate: number | null;
  atRiskStudents: {
    regNumber: string;
    name: string;
    courseCode: string;
    attended: number;
    total: number;
    pct: number;
  }[];
}) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("RollMark — Attendance Analytics", 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`Generated ${formatDate(Date.now())}`, 14, 26);

  autoTable(doc, {
    startY: 34,
    head: [["Metric", "Value"]],
    body: [
      ["Total sessions", String(opts.totalSessions)],
      ["Students marked overall", String(opts.totalStudentsMarked)],
      ["Avg. attendance rate", opts.avgAttendanceRate !== null ? `${opts.avgAttendanceRate}%` : "—"],
    ],
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 10 },
  });

  const afterMetricsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Students below 75% attendance (${opts.atRiskStudents.length})`, 14, afterMetricsY + 12);

  autoTable(doc, {
    startY: afterMetricsY + 18,
    head: [["Reg Number", "Name", "Course", "Attended", "%"]],
    body: opts.atRiskStudents.map((s) => [
      s.regNumber,
      s.name,
      s.courseCode,
      `${s.attended}/${s.total}`,
      `${s.pct}%`,
    ]),
    headStyles: { fillColor: [244, 63, 94] },
    styles: { fontSize: 9 },
  });

  doc.save("rollmark-analytics-report.pdf");
}
