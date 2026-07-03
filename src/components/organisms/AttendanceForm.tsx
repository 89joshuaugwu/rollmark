"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Confetti } from "@/components/ui/Confetti";
import { getSession, submitAttendance, DuplicateAttendanceError } from "@/lib/firestore";
import { getCurrentLocation, watchLocation, GeolocationError } from "@/lib/geolocation";
import { getDeviceFingerprint } from "@/lib/qrToken";
import { haversineMeters, formatDistance } from "@/lib/utils";
import type { AttendanceSession, GeoPoint } from "@/types";

type Stage = "loading" | "invalid" | "expired" | "ended" | "form" | "success";

export function AttendanceForm({ sessionId, token }: { sessionId: string; token?: string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [session, setSession] = useState<AttendanceSession | null>(null);

  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locating, setLocating] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    getSession(sessionId).then((s) => {
      if (!s) {
        setStage("invalid");
        return;
      }
      setSession(s);
      if (s.status === "ended") {
        setStage("ended");
        return;
      }
      if (token && s.qrToken !== token) {
        setStage("expired");
        return;
      }
      setStage("form");
    });
  }, [sessionId, token]);

  // Live geofence check for STRICT sessions
  useEffect(() => {
    if (!session || session.mode !== "STRICT" || !session.geofence) return;

    const unsub = watchLocation(
      (point) => {
        setLocation(point);
        setLocationDenied(false);
        setDistance(haversineMeters(point, session.geofence!.center));
      },
      (err) => {
        if (err.code === "denied") setLocationDenied(true);
      }
    );
    return unsub;
  }, [session]);

  const requestLocation = async () => {
    setLocating(true);
    try {
      const point = await getCurrentLocation();
      setLocation(point);
      setLocationDenied(false);
      if (session?.geofence) setDistance(haversineMeters(point, session.geofence.center));
    } catch (err) {
      if (err instanceof GeolocationError && err.code === "denied") setLocationDenied(true);
    } finally {
      setLocating(false);
    }
  };

  if (stage === "loading") {
    return <p className="py-16 text-center text-sm text-text-secondary">Loading session...</p>;
  }

  if (stage === "invalid") {
    return <StatusMessage title="Session not found" body="Check the link and try again." />;
  }

  if (stage === "ended") {
    return (
      <StatusMessage
        title="This session has ended"
        body="Attendance is closed. Contact your lecturer if you think this is a mistake."
      />
    );
  }

  if (stage === "expired") {
    return (
      <StatusMessage
        title="This QR code has expired"
        body="Ask your lecturer to refresh the display and scan again."
      />
    );
  }

  if (stage === "success") {
    return (
      <div className="relative flex flex-col items-center py-14 text-center">
        <Confetti />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <CheckCircle2 className="mx-auto h-16 w-16 text-lime" />
        </motion.div>
        <h2 className="mt-4 text-xl font-bold">Attendance recorded ✓</h2>
        <p className="mt-1 text-sm text-text-secondary">You may close this page.</p>
      </div>
    );
  }

  if (!session) return null;
  const visibleFields = session.fields.filter((f) => f.requirement !== "off");
  const isStrict = session.mode === "STRICT" && !!session.geofence;
  const outOfRange = isStrict && distance !== null && distance > session.geofence!.radiusMeters;

  const handleChange = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const allRequiredFilled = visibleFields
    .filter((f) => f.requirement === "required")
    .every((f) => (values[f.key] ?? "").trim().length > 0);

  const canSubmit = allRequiredFilled && (!isStrict || (location && !outOfRange)) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setFormError("");
    setSubmitting(true);
    try {
      await submitAttendance({
        sessionId: session.id,
        lecturerId: session.lecturerId,
        courseCode: session.courseCode,
        regNumber: values["regNumber"] ?? "",
        firstName: values["firstName"] ?? "",
        surname: values["surname"] ?? "",
        middleName: values["middleName"],
        phone: values["phone"],
        email: values["email"],
        location: location ?? undefined,
        distanceFromLecturerMeters: distance ?? undefined,
        deviceFingerprint: getDeviceFingerprint(),
      });
      setStage("success");
    } catch (err) {
      if (err instanceof DuplicateAttendanceError) {
        setFormError("You've already marked attendance for this session.");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md py-6">
      <h1 className="text-xl font-bold">Mark your attendance</h1>
      <p className="mt-1 text-sm text-text-secondary">
        {session.courseCode} — {session.courseName}
      </p>

      {isStrict && (
        <div className="mt-4 rounded-lg border border-white/10 bg-slate-800/50 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Location Verification
            </span>
            {location && (
              <span className="text-xs text-text-secondary">
                Target: Within {session.geofence!.radiusMeters}m
              </span>
            )}
          </div>

          {!location && !locationDenied && (
            <Button type="button" onClick={requestLocation} loading={locating} variant="secondary" fullWidth>
              <MapPin className="h-4 w-4" />
              Allow location access
            </Button>
          )}

          {locationDenied && (
            <div className="space-y-2.5">
              <p className="flex items-start gap-2 text-sm text-rose">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Location permission denied. Please enable location access in your browser settings to proceed.</span>
              </p>
              <Button type="button" onClick={requestLocation} loading={locating} variant="secondary" fullWidth>
                <RefreshCw className="h-4 w-4" />
                Try requesting again
              </Button>
            </div>
          )}

          {location && !outOfRange && (
            <div className="space-y-2.5">
              <p className="flex items-center gap-2 text-sm text-emerald">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald" />
                Location verified · ±{Math.round(location.accuracy)}m accuracy
              </p>
              <Button type="button" onClick={requestLocation} loading={locating} variant="ghost" fullWidth className="text-xs text-text-secondary hover:text-white min-h-[36px] md:min-h-[36px]">
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh location
              </Button>
            </div>
          )}

          {location && outOfRange && (
            <div className="space-y-2.5">
              <motion.p
                className="flex items-start gap-2 text-sm text-rose"
                animate={{ x: [0, -4, 4, -4, 0] }}
                transition={{ duration: 0.2 }}
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>You are {formatDistance(distance!)} away. Move closer to the classroom.</span>
              </motion.p>
              <Button type="button" onClick={requestLocation} loading={locating} variant="secondary" fullWidth>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh location
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3.5">
        {visibleFields.map((field) => (
          <Input
            key={field.key}
            label={field.label}
            required={field.requirement === "required"}
            value={values[field.key] ?? ""}
            onChange={(e) => handleChange(field.key, e.target.value)}
          />
        ))}
      </div>

      {formError && (
        <p className="mt-3 flex items-center gap-2 text-sm text-rose">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {formError}
        </p>
      )}

      <div className="sticky bottom-4 mt-6">
        <Button fullWidth disabled={!canSubmit} loading={submitting} onClick={handleSubmit}>
          Submit attendance
        </Button>
      </div>
    </div>
  );
}

function StatusMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <AlertCircle className="h-12 w-12 text-amber" />
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-1.5 max-w-xs text-sm text-text-secondary">{body}</p>
    </div>
  );
}
