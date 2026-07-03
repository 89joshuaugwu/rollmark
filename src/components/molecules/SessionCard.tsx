import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatTime } from "@/lib/utils";
import type { AttendanceSession } from "@/types";

export function SessionCard({ session }: { session: AttendanceSession }) {
  const href =
    session.status === "active"
      ? `/dashboard/sessions/${session.id}`
      : `/dashboard/sessions/${session.id}/history`;

  return (
    <Link href={href}>
      <Card className="flex items-center justify-between gap-3 hover:border-emerald/40">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">
            {session.courseCode} — {session.courseName}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {formatDate(session.date)} · {formatTime(session.startTime)}–
            {formatTime(session.endTime)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {session.studentsMarked} student{session.studentsMarked === 1 ? "" : "s"} marked ·{" "}
            {session.mode === "STRICT" ? "Geofenced" : "QR only"}
          </p>
        </div>
        <Badge status={session.status === "active" ? "active" : "ended"}>
          {session.status === "active" ? "Live now" : "Ended"}
        </Badge>
      </Card>
    </Link>
  );
}
