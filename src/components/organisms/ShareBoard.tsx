"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, MapPin, PauseCircle, RefreshCw } from "lucide-react";
import { QRDisplay } from "@/components/molecules/QRDisplay";
import { Button } from "@/components/ui/Button";
import { buildAttendUrl } from "@/lib/qrToken";
import { getCurrentLocation, watchLocation, GeolocationError } from "@/lib/geolocation";
import type { GeoPoint } from "@/types";

// "invalid" is reserved for a genuine server-confirmed bad slug — it must
// never be the fallback for "we don't know yet" or "something went wrong,"
// since that reads to a student as "this link is broken," when the far more
// common real reason is simply that location hasn't been granted yet. Every
// other uncertain case routes to "needsLocation" or "checkFailed" instead,
// both of which show an explicit action (enable location / try again)
// rather than a dead end.
type Stage =
  | "checking"
  | "invalid"
  | "needsLocation"
  | "outOfRange"
  | "noSession"
  | "checkFailed"
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
  const [stage, setStage] = useState<Stage>("checking");
  const [session, setSession] = useState<LiveSessionInfo | null>(null);
  const [courseLabel, setCourseLabel] = useState<{ code: string; name: string } | null>(null);

  // True once we've successfully shown a live QR at least once — lets a
  // later out-of-range result read as "paused" (keep showing the last QR,
  // greyed out) instead of yanking the page back to a blank state.
  const wasLiveRef = useRef(false);
  const locationRef = useRef<GeoPoint | null>(null);
  const hasLocationOnceRef = useRef(false);
  const [locating, setLocating] = useState(false);

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
          // We haven't sent a location fix yet — this is the single most
          // common state a first-time visitor hits, so it gets its own
          // clear stage with an explicit "Allow location access" button,
          // not a silent spinner and not an "invalid link" message.
          setStage("needsLocation");
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
          setStage("checkFailed");
      }
    } catch {
      // Transient network blip — don't blow away a currently-live QR over
      // one failed poll; just skip this tick and try again next interval.
      // Never falls through to "invalid" — a network error says nothing
      // about whether the slug itself is valid.
      if (!wasLiveRef.current) setStage("checkFailed");
    }
  }, [slug]);

  useEffect(() => {
    const unsub = watchLocation(
      (point) => {
        locationRef.current = point;
        if (!hasLocationOnceRef.current) {
          hasLocationOnceRef.current = true;
          check(); // first real fix arrived — re-check immediately
        }
      },
      () => {
        // Denied/unavailable from the passive watch — stay on whatever
        // stage check() already produced (almost always "needsLocation"),
        // which already shows the explicit "Allow location access" button.
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
    setLocating(true);
    try {
      const point = await getCurrentLocation();
      locationRef.current = point;
      hasLocationOnceRef.current = true;
      await check();
    } catch (err) {
      if (err instanceof GeolocationError) {
        // Still show the same actionable button rather than a dead end —
        // denial just means they need to retry after fixing permissions.
        setStage("needsLocation");
      }
    } finally {
      setLocating(false);
    }
  };

  if (stage === "checking") {
    return <StatusMessage title="Checking..." body="Finding your class." />;
  }

  if (stage === "invalid") {
    return <StatusMessage title="Link not found" body="Check the link and try again." />;
  }

  if (stage === "checkFailed") {
    return (
      <ActionableMessage
        title="Something went wrong"
        body="Couldn't reach the server. Check your connection and try again."
        actionLabel="Try again"
        actionIcon={<RefreshCw className="h-4 w-4" />}
        onAction={check}
        loading={locating}
      />
    );
  }

  if (stage === "needsLocation") {
    return (
      <ActionableMessage
        title="Location needed"
        body="This link only opens near the classroom. Allow location access to continue."
        actionLabel="Allow location access"
        actionIcon={<MapPin className="h-4 w-4" />}
        onAction={requestLocation}
        loading={locating}
        secondaryLabel="Try again"
        onSecondary={check}
      />
    );
  }

  if (stage === "outOfRange" && !wasLiveRef.current) {
    return (
      <ActionableMessage
        title="Not available here"
        body="You must be close to the classroom to open this page."
        actionLabel="Try again"
        actionIcon={<RefreshCw className="h-4 w-4" />}
        onAction={check}
        loading={locating}
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

function ActionableMessage({
  title,
  body,
  actionLabel,
  actionIcon,
  onAction,
  loading,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onAction: () => void;
  loading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <AlertCircle className="h-12 w-12 text-amber" />
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1.5 max-w-xs text-sm text-text-secondary">{body}</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button loading={loading} onClick={onAction}>
          {actionIcon}
          {actionLabel}
        </Button>
        {secondaryLabel && onSecondary && (
          <button
            onClick={onSecondary}
            className="inline-flex items-center gap-1 text-xs text-emerald hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
