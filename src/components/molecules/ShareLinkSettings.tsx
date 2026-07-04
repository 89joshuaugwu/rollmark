"use client";

import { useState } from "react";
import { Copy, Check, MapPin, RefreshCw, Share2 } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { GeofenceRadius } from "@/components/molecules/GeofenceRadius";
import { LocationPill } from "@/components/molecules/LocationPill";
import { notify } from "@/components/ui/Toast";
import { setCourseShareSettings, ensureCourseShareSlug } from "@/lib/firestore";
import { getCurrentLocation, GeolocationError } from "@/lib/geolocation";
import type { Course, GeoPoint } from "@/types";

export function ShareLinkSettings({
  course,
  onSlugBackfilled,
}: {
  course: Course;
  onSlugBackfilled: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(course.shareGeofenceEnabled);
  const [location, setLocation] = useState<GeoPoint | null>(
    course.shareGeofence?.center ?? null
  );
  const [radius, setRadius] = useState(course.shareGeofence?.radiusMeters ?? 50);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const slug = course.shareSlug;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = slug ? `${origin}/s/${slug}` : "";

  const handleOpen = async () => {
    if (!slug) {
      try {
        const newSlug = await ensureCourseShareSlug(course.id, course.code);
        onSlugBackfilled(newSlug);
      } catch {
        notify.error("Couldn't generate a share link");
        return;
      }
    }
    setOpen(true);
  };

  const captureLocation = async () => {
    setLocating(true);
    try {
      const point = await getCurrentLocation();
      setLocation(point);
    } catch (err) {
      if (err instanceof GeolocationError) notify.error(err.message);
    } finally {
      setLocating(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    if (next && !location) {
      notify.error("Capture a location first to enable range-gating");
      return;
    }
    setEnabled(next);
    setSaving(true);
    try {
      await setCourseShareSettings(course.id, {
        enabled: next,
        ...(location ? { geofence: { center: location, radiusMeters: radius } } : {}),
      });
    } catch {
      notify.error("Couldn't save share settings");
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGeofence = async () => {
    if (!location) return;
    setSaving(true);
    try {
      await setCourseShareSettings(course.id, {
        enabled,
        geofence: { center: location, radiusMeters: radius },
      });
      notify.success("Share range updated");
    } catch {
      notify.error("Couldn't save share settings");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    notify.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={handleOpen}>
        <Share2 className="h-4 w-4" />
        Share link
      </Button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-white/10 p-3.5">
      <div>
        <p className="text-xs font-medium text-text-secondary">Static share link</p>
        <p className="mt-1 text-[11px] text-text-secondary">
          Post this once in the class group — it always shows whichever session on this course is
          currently live, so it never needs reposting.
        </p>
        {shareUrl && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-white">{shareUrl}</span>
            <button
              onClick={copyLink}
              className="flex shrink-0 items-center gap-1 text-xs text-emerald hover:underline"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-lime" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      <Toggle
        checked={enabled}
        onChange={handleToggle}
        label="Require range to open this link"
        description="Whoever opens it (e.g. course rep) must be physically near the classroom."
      />

      {enabled && (
        <div className="space-y-3">
          {location ? (
            <div className="flex flex-wrap items-center gap-2">
              <LocationPill point={location} label="Classroom location" />
              <button
                type="button"
                onClick={captureLocation}
                className="inline-flex items-center gap-1 text-xs text-emerald hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Recapture
              </button>
            </div>
          ) : (
            <Button variant="secondary" loading={locating} onClick={captureLocation}>
              <MapPin className="h-4 w-4" />
              Capture location
            </Button>
          )}
          <GeofenceRadius value={radius} onChange={setRadius} />
          <Button variant="secondary" loading={saving} onClick={handleSaveGeofence}>
            Save range
          </Button>
        </div>
      )}

      <button
        onClick={() => setOpen(false)}
        className="text-xs text-text-secondary hover:text-white hover:underline"
      >
        Close
      </button>
    </div>
  );
}
