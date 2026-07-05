import type { GeoPoint } from "@/types";

export class GeolocationError extends Error {
  code: "denied" | "unavailable" | "timeout";
  constructor(code: "denied" | "unavailable" | "timeout", message: string) {
    super(message);
    this.code = code;
  }
}

function requestPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function toPoint(pos: GeolocationPosition): GeoPoint {
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
}

/**
 * Tries a high-accuracy GPS fix first (best for STRICT-mode precision), but
 * falls back to a low-accuracy, network/WiFi-based fix if that fails or
 * times out. High-accuracy GPS frequently fails outright on laptops without
 * a GPS chip, or indoors with weak signal — exactly the lecture-hall
 * scenario this app runs in — so treating that as a hard failure was
 * rejecting requests that a lower-accuracy fix would have satisfied fine.
 * PERMISSION_DENIED is not retried — no amount of retrying fixes that.
 */
export async function getCurrentLocation(): Promise<GeoPoint> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new GeolocationError("unavailable", "Geolocation is not supported on this device.");
  }

  try {
    const pos = await requestPosition({ enableHighAccuracy: true, timeout: 8_000, maximumAge: 0 });
    return toPoint(pos);
  } catch (err) {
    const geoErr = err as GeolocationPositionError;
    if (geoErr.code === geoErr.PERMISSION_DENIED) {
      throw new GeolocationError("denied", "Location permission was denied.");
    }

    // High-accuracy failed or timed out — retry with a longer timeout and
    // high-accuracy off, which lets the browser use WiFi/cell-tower
    // positioning instead of requiring a GPS fix.
    try {
      const pos = await requestPosition({
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: 30_000,
      });
      return toPoint(pos);
    } catch (err2) {
      const geoErr2 = err2 as GeolocationPositionError;
      if (geoErr2.code === geoErr2.PERMISSION_DENIED) {
        throw new GeolocationError("denied", "Location permission was denied.");
      }
      if (geoErr2.code === geoErr2.TIMEOUT) {
        throw new GeolocationError(
          "timeout",
          "Location request timed out. Move somewhere with a clearer view of the sky or better signal, then try again."
        );
      }
      throw new GeolocationError(
        "unavailable",
        "Could not determine location. On a laptop, check that location services are turned on at the OS level (Windows: Settings → Privacy & Security → Location). On mobile, make sure location/GPS is enabled."
      );
    }
  }
}

export function watchLocation(
  onUpdate: (point: GeoPoint) => void,
  onError: (err: GeolocationError) => void
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError(new GeolocationError("unavailable", "Geolocation is not supported on this device."));
    return () => {};
  }

  // watchPosition doesn't support the same try-high-then-low-accuracy
  // fallback as getCurrentLocation (there's no single "final failure"
  // moment to fall back from), so it stays high-accuracy — callers that
  // need robustness against outright failures should prefer
  // getCurrentLocation for the initial fix and use watchLocation only for
  // continuous updates after that first fix succeeds.
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onUpdate(toPoint(pos)),
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        onError(new GeolocationError("denied", "Location permission was denied."));
      } else if (err.code === err.TIMEOUT) {
        onError(new GeolocationError("timeout", "Location request timed out."));
      } else {
        onError(new GeolocationError("unavailable", "Could not determine location."));
      }
    },
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
