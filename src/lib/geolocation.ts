import type { GeoPoint } from "@/types";

export class GeolocationError extends Error {
  code: "denied" | "unavailable" | "timeout";
  constructor(code: "denied" | "unavailable" | "timeout", message: string) {
    super(message);
    this.code = code;
  }
}

export function getCurrentLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new GeolocationError("unavailable", "Geolocation is not supported on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new GeolocationError("denied", "Location permission was denied."));
        } else if (err.code === err.TIMEOUT) {
          reject(new GeolocationError("timeout", "Location request timed out."));
        } else {
          reject(new GeolocationError("unavailable", "Could not determine location."));
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  });
}

export function watchLocation(
  onUpdate: (point: GeoPoint) => void,
  onError: (err: GeolocationError) => void
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError(new GeolocationError("unavailable", "Geolocation is not supported on this device."));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        onError(new GeolocationError("denied", "Location permission was denied."));
      } else {
        onError(new GeolocationError("unavailable", "Could not determine location."));
      }
    },
    { enableHighAccuracy: true, maximumAge: 5_000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
