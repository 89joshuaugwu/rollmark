"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, MapPin, PauseCircle } from "lucide-react";
import { QRDisplay } from "@/components/molecules/QRDisplay";
import { Button } from "@/components/ui/Button";
import { buildAttendUrl } from "@/lib/qrToken";
import { getCurrentLocation, watchLocation, GeolocationError } from "@/lib/geolocation";
import type { GeoPoint } from "@/types";

type Stage =
  | "loading"
  | "invalid"
  | "locationDenied"
  | "outOfRange"
  | "noSession"
  | "live";

interface LiveSessionInfo {
  id: string;
  qrToken: string;
  qrTokenUpdatedAt: number;
  courseCode: string;
  courseName: string;
}

const RECHECK_MS = 30_000;

export function ShareBoard({ slug }: { slug: string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [session, setSession] = useState<LiveSessionInfo | null>(null);
  const [courseLabel, setCourseLabel] = useState<{ code: string; name: string } | null>(null);
  // True once we've successfully shown a live QR at least once — lets a
  // later out-of-range result read as "paused" (keep showing the last QR,
  // greyed out) instead of yanking the page back to a blank error state.
  const wasLiveRef = useRef(false);

  const locationRef = useRef<GeoPoint | null>(null);
  const hasLocationOnceRef = useRef(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const check = useCallback(async () => {
    const loc = locationRef.current;
    const qs = new URLSearchParams();
    if (loc) {
      qs.set("lat", String(loc.lat));
      qs.set("lng", String(loc.lng));
    }

    try {
      const res = await fetch(`/api/share/${slug}?${qs.toString()}`);
      const body = await res.json();

      switch (body.status) {
        case "invalid":
          setStage("invalid");
          break;
        case "location_required":
          // Geofencing is on for this course but we don't have a fix yet —
          // stay on "loading" rather than flashing an error; the effect
          // below re-checks the moment a location fix arrives.
          if (!hasLocationOnceRef.current) setStage("loading");
          break;
        case "out_of_range":
          setStage("outOfRange");
          break;
        case "no_session":
          wasLiveRef.current = false;
          setCourseLabel({ code: body.courseCode, name: body.courseName });
          setStage("noSession");
          break;
        case "ok":
          wasLiveRef.current = true;
          setSession(body.session);
          setStage("live");
          break;
        default:
          setStage("invalid");
      }
    } catch {
      // Transient network blip — don't blow away a currently-live QR over
      // one failed poll; just skip this tick and try again next interval.
      if (!wasLiveRef.current) setStage("invalid");
    }
  }, [slug]);

  useEffect(() => {
    const unsub = watchLocation(
      (point) => {
        locationRef.current = point;
        setLocationDenied(false);
        if (!hasLocationOnceRef.current) {
          hasLocationOnceRef.current = true;
          check(); // first real fix arrived — re-check immediately
        }
      },
      (err) => {
        if (err.code === "denied") setLocationDenied(true);
      }
    );
    return unsub;
  }, [check]);

  useEffect(() => {
    check();
    const interval = setInterval(check, RECHECK_MS);
    return () => clearInterval(interval);
  }, [check]);

  const requestLocation = async () => {
    try {
      const point = await getCurrentLocation();
      locationRef.current = point;
      setLocationDenied(false);
      hasLocationOnceRef.current = true;
      check();
    } catch (err) {
      if (err instanceof GeolocationError && err.code === "denied") setLocationDenied(true);
    }
  };

  if (stage === "loading") {
    return <StatusMessage title="Checking..." body="Finding your class." />;
  }

  if (stage === "invalid") {
    return <StatusMessage title="Link not found" body="Check the link and try again." />;
  }

  if (locationDenied && (stage === "outOfRange" || !hasLocationOnceRef.current)) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-amber" />
        <div>
          <h2 className="text-lg font-bold">Location needed</h2>
          <p className="mt-1.5 max-w-xs text-sm text-text-secondary">
            This link only opens near the classroom. Enable location access to continue.
          </p>
        </div>
        <Button onClick={requestLocation}>
          <MapPin className="h-4 w-4" />
          Allow location access
        </Button>
      </div>
    );
  }

  if (stage === "outOfRange" && !wasLiveRef.current) {
    return (
      <StatusMessage
        title="Not available here"
        body="You must be close to the classroom to open this page."
      />
    );
  }

  if (stage === "noSession") {
    return (
      <StatusMessage
        title="No class in session right now"
        body={courseLabel ? `${courseLabel.code} — ${courseLabel.name}` : undefined}
      />
    );
  }

  if (!session) {
    return <StatusMessage title="Checking..." body="Finding your class." />;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrValue = buildAttendUrl(origin, session.id, session.qrToken);
  const paused = stage === "outOfRange";

  return (
    <div className="w-full max-w-md py-6 text-center">
      <h1 className="text-xl font-bold">
        {session.courseCode} — {session.courseName}
      </h1>
      <p className="mt-1 text-sm text-text-secondary">Scan with your own device</p>

      <div className={`relative mt-6 flex justify-center ${paused ? "opacity-40" : ""}`}>
        <QRDisplay value={qrValue} qrTokenUpdatedAt={session.qrTokenUpdatedAt} />
      </div>

      {paused && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-amber">
          <PauseCircle className="h-4 w-4 shrink-0" />
          Paused — move back into range to resume
        </div>
      )}
    </div>
  );
}

function StatusMessage({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <AlertCircle className="h-12 w-12 text-amber" />
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      {body && <p className="mt-1.5 max-w-xs text-sm text-text-secondary">{body}</p>}
    </div>
  );
}
