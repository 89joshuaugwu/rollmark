"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, UserPlus, MapPin } from "lucide-react";
import { QRDisplay } from "@/components/molecules/QRDisplay";
import { LocationPill } from "@/components/molecules/LocationPill";
import { GeofenceRadius } from "@/components/molecules/GeofenceRadius";
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
import {
  rotateQrTokenAction,
  updateGeofenceAction,
  setRequireGeofenceAction,
  endSessionAction,
} from "@/lib/actions/session-actions";
import { buildAttendUrl, msUntilNextRotation, QR_ROTATION_MS } from "@/lib/qrToken";
import { getCurrentLocation, GeolocationError } from "@/lib/geolocation";
import { timeAgo, parseNaijaDateTime } from "@/lib/utils";
import type { AttendanceRecord, AttendanceSession, GeoPoint } from "@/types";

export function LiveSessionBoard({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [recapturing, setRecapturing] = useState(false);

  const [showEnableGeofence, setShowEnableGeofence] = useState(false);
  const [newGeofenceLocation, setNewGeofenceLocation] = useState<GeoPoint | null>(null);
  const [newGeofenceRadius, setNewGeofenceRadius] = useState(50);
  const [locatingForEnable, setLocatingForEnable] = useState(false);
  const [savingGeofenceToggle, setSavingGeofenceToggle] = useState(false);

  const [manualReg, setManualReg] = useState("");
  const [manualFirst, setManualFirst] = useState("");
  const [manualSurname, setManualSurname] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const knownRecordIds = useRef<Set<string>>(new Set());
  const isFirstRecordsLoad = useRef(true);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToSession(sessionId, setSession);
    return () => unsub();
  }, [sessionId, user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRecords(sessionId, user.uid, (recs) => {
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

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const ms = msUntilNextRotation(session.qrTokenUpdatedAt);
    const timeout = setTimeout(async () => {
      await rotateQrTokenAction(sessionId);
    }, ms || QR_ROTATION_MS);
    return () => clearTimeout(timeout);
  }, [session, sessionId]);

  // Auto-end the session the instant its scheduled endTime passes, for
  // whoever currently has this board open. This is the *immediate* path —
  // the /api/cron/end-expired-sessions cron job is the authoritative
  // backstop for sessions nobody is actively watching, since a browser tab
  // can't fire a timer for a page that's closed. Both write the same
  // `status: "ended"`, so whichever gets there first is fine.
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const msUntilExpiry = parseNaijaDateTime(session.endTime) - Date.now();
    if (msUntilExpiry <= 0) {
      endSessionAction(sessionId).then(() => {
        notify.info("Session auto-ended — its scheduled time was reached");
        router.push(`/dashboard/sessions/${sessionId}/history`);
      });
      return;
    }
    const timeout = setTimeout(async () => {
      await endSessionAction(sessionId);
      notify.info("Session auto-ended — its scheduled time was reached");
      router.push(`/dashboard/sessions/${sessionId}/history`);
    }, msUntilExpiry);
    return () => clearTimeout(timeout);
  }, [session, sessionId, router]);

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

  const captureForEnable = async () => {
    setLocatingForEnable(true);
    try {
      const point = await getCurrentLocation();
      setNewGeofenceLocation(point);
    } catch (err) {
      if (err instanceof GeolocationError) notify.error(err.message);
    } finally {
      setLocatingForEnable(false);
    }
  };

  const handleEnableGeofence = async () => {
    if (!newGeofenceLocation) {
      notify.error("Capture your location first");
      return;
    }
    setSavingGeofenceToggle(true);
    try {
      await setRequireGeofenceAction(sessionId, true, {
        center: newGeofenceLocation,
        radiusMeters: newGeofenceRadius,
      });
      notify.success("Location requirement turned on");
      setShowEnableGeofence(false);
    } catch {
      notify.error("Couldn't enable location requirement");
    } finally {
      setSavingGeofenceToggle(false);
    }
  };

  const handleDisableGeofence = async () => {
    setSavingGeofenceToggle(true);
    try {
      await setRequireGeofenceAction(sessionId, false);
      notify.success("Location requirement turned off");
    } catch {
      notify.error("Couldn't turn off location requirement");
    } finally {
      setSavingGeofenceToggle(false);
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

      {session.requireGeofence && session.geofence ? (
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
          <button
            onClick={handleDisableGeofence}
            disabled={savingGeofenceToggle}
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-rose hover:underline disabled:opacity-50"
          >
            Turn off
          </button>
        </div>
      ) : !showEnableGeofence ? (
        <div className="mb-6">
          <button
            onClick={() => setShowEnableGeofence(true)}
            className="inline-flex items-center gap-1.5 text-xs text-emerald hover:underline"
          >
            <MapPin className="h-3.5 w-3.5" />
            Turn on location requirement for this session
          </button>
        </div>
      ) : (
        <div className="mb-6 space-y-3 rounded-lg border border-white/10 p-3.5">
          {newGeofenceLocation ? (
            <LocationPill point={newGeofenceLocation} />
          ) : (
            <Button variant="secondary" loading={locatingForEnable} onClick={captureForEnable}>
              <MapPin className="h-4 w-4" />
              Capture location
            </Button>
          )}
          <GeofenceRadius value={newGeofenceRadius} onChange={setNewGeofenceRadius} />
          <div className="flex gap-2">
            <Button loading={savingGeofenceToggle} onClick={handleEnableGeofence}>
              Turn on
            </Button>
            <Button variant="ghost" onClick={() => setShowEnableGeofence(false)}>
              Cancel
            </Button>
          </div>
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
