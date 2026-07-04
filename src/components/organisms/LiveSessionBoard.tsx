"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, UserPlus } from "lucide-react";
import { QRDisplay } from "@/components/molecules/QRDisplay";
import { LocationPill } from "@/components/molecules/LocationPill";
import { LiveTicker } from "@/components/molecules/LiveTicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { notify } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeToSession,
  subscribeToRecords,
  markAttendanceManually,
  removeAttendanceRecord,
  flagAttendanceRecord,
  unflagAttendanceRecord,
} from "@/lib/firestore";
import { rotateQrTokenAction, updateGeofenceAction, endSessionAction } from "@/lib/actions/session-actions";
import { buildAttendUrl, msUntilNextRotation, QR_ROTATION_MS } from "@/lib/qrToken";
import { getCurrentLocation, GeolocationError } from "@/lib/geolocation";
import { timeAgo } from "@/lib/utils";
import type { AttendanceRecord, AttendanceSession } from "@/types";

export function LiveSessionBoard({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [recapturing, setRecapturing] = useState(false);

  const [manualReg, setManualReg] = useState("");
  const [manualFirst, setManualFirst] = useState("");
  const [manualSurname, setManualSurname] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const knownRecordIds = useRef<Set<string>>(new Set());
  const isFirstRecordsLoad = useRef(true);

  // Both listeners wait on `user` (populated once Firebase Auth's client
  // SDK finishes restoring the session from IndexedDB) instead of firing
  // on mount. dashboard/layout.tsx's server-side cookie check happens on
  // a completely separate auth path — it does NOT guarantee the client
  // Firebase Auth SDK has attached an ID token yet. Without this guard,
  // whichever listener's request goes out before that token attaches gets
  // a permanent permission-denied (Firestore does not auto-retry a
  // security-rule rejection), which is why this looked like an
  // intermittent, non-deterministic failure — one listener would win the
  // race and the other wouldn't.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToSession(sessionId, setSession);
    return () => unsub();
  }, [sessionId, user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRecords(sessionId, (recs) => {
      if (!isFirstRecordsLoad.current) {
        const newOnes = recs.filter((r) => !knownRecordIds.current.has(r.id));
        newOnes.forEach((r) => {
          if (r.markedManually) return;
          if (r.flagged) {
            notify.info(`⚠️ Possible duplicate device: ${r.surname} ${r.firstName}`);
          } else {
            notify.success(`New attendance: ${r.surname} ${r.firstName}`);
          }
        });
      }
      knownRecordIds.current = new Set(recs.map((r) => r.id));
      isFirstRecordsLoad.current = false;
      setRecords(recs);
    });
    return () => unsub();
  }, [sessionId, user]);

  // Auto-rotate the QR token every 60s while the session is active.
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const ms = msUntilNextRotation(session.qrTokenUpdatedAt);
    const timeout = setTimeout(async () => {
      await rotateQrTokenAction(sessionId);
    }, ms || QR_ROTATION_MS);
    return () => clearTimeout(timeout);
  }, [session, sessionId]);

  if (!session) {
    return <p className="py-10 text-center text-sm text-text-secondary">Loading session...</p>;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrValue = buildAttendUrl(origin, sessionId, session.qrToken);

  const handleRecapture = async () => {
    setRecapturing(true);
    try {
      const point = await getCurrentLocation();
      await updateGeofenceAction(sessionId, {
        center: point,
        radiusMeters: session.geofence?.radiusMeters ?? 50,
      });
      notify.success("Location updated");
    } catch (err) {
      if (err instanceof GeolocationError) notify.error(err.message);
    } finally {
      setRecapturing(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualReg.trim() || !manualFirst.trim() || !manualSurname.trim()) return;
    setManualSubmitting(true);
    try {
      await markAttendanceManually({
        sessionId,
        lecturerId: session.lecturerId,
        courseCode: session.courseCode,
        regNumber: manualReg,
        firstName: manualFirst,
        surname: manualSurname,
      });
      notify.success("Student added");
      setManualReg("");
      setManualFirst("");
      setManualSurname("");
      setShowManualAdd(false);
    } catch {
      notify.error("Couldn't add student");
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleEnd = async () => {
    setEnding(true);
    try {
      await endSessionAction(sessionId);
      notify.success("Session ended");
      router.push(`/dashboard/sessions/${sessionId}/history`);
    } catch {
      notify.error("Couldn't end the session");
    } finally {
      setEnding(false);
      setShowEndConfirm(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {session.courseCode} — {session.courseName}
          </h1>
          <p className="text-xs text-text-secondary">Started {timeAgo(session.createdAt)}</p>
        </div>
        <Badge status="active">Live now</Badge>
      </div>

      <div className="mb-6 flex justify-center">
        <QRDisplay value={qrValue} qrTokenUpdatedAt={session.qrTokenUpdatedAt} />
      </div>

      {session.mode === "STRICT" && session.geofence && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <LocationPill point={session.geofence.center} />
          <span className="text-xs text-text-secondary">
            · {session.geofence.radiusMeters}m radius
          </span>
          <button
            onClick={handleRecapture}
            disabled={recapturing}
            className="inline-flex items-center gap-1 text-xs text-emerald hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${recapturing ? "animate-spin" : ""}`} />
            Recapture
          </button>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Attendance marked ({records.length})
          </h3>
          <button
            onClick={() => setShowManualAdd(true)}
            className="inline-flex items-center gap-1 text-xs text-emerald hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add manually
          </button>
        </div>
        <LiveTicker
          records={records}
          onRemove={(r) => removeAttendanceRecord(r.id, sessionId)}
          onFlag={(r) => flagAttendanceRecord(r.id, "Flagged by lecturer")}
          onUnflag={(r) => unflagAttendanceRecord(r.id)}
        />
      </div>

      <div className="fixed inset-x-0 bottom-16 border-t border-white/5 bg-bg/95 p-4 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto max-w-5xl">
          <Button variant="danger" fullWidth onClick={() => setShowEndConfirm(true)}>
            End session
          </Button>
        </div>
      </div>

      <Modal open={showManualAdd} onClose={() => setShowManualAdd(false)} title="Add manually">
        <div className="space-y-3">
          <Input
            label="Reg number"
            required
            value={manualReg}
            onChange={(e) => setManualReg(e.target.value)}
          />
          <Input
            label="First name"
            required
            value={manualFirst}
            onChange={(e) => setManualFirst(e.target.value)}
          />
          <Input
            label="Surname"
            required
            value={manualSurname}
            onChange={(e) => setManualSurname(e.target.value)}
          />
          <Button fullWidth loading={manualSubmitting} onClick={handleManualAdd}>
            Add student
          </Button>
        </div>
      </Modal>

      <Modal open={showEndConfirm} onClose={() => setShowEndConfirm(false)} title="End session?">
        <p className="text-sm text-text-secondary">
          Attendance will be locked and the QR code will stop working. This can&apos;t be undone.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" onClick={() => setShowEndConfirm(false)} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" loading={ending} onClick={handleEnd} className="flex-1">
            End session
          </Button>
        </div>
      </Modal>
    </div>
  );
}
