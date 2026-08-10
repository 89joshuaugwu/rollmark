import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GeoPoint } from "@/types";

export function LocationPill({
  point,
  label = "Your location",
  className,
}: {
  point: GeoPoint;
  label?: string;
  className?: string;
}) {
  const latHemisphere = point.lat >= 0 ? "N" : "S";
  const lngHemisphere = point.lng >= 0 ? "E" : "W";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-3 py-1.5 text-sm text-emerald",
        className
      )}
    >
      <MapPin className="h-4 w-4 shrink-0" />
      <span className="font-mono text-xs">
        {label}: {Math.abs(point.lat).toFixed(4)}°{latHemisphere},{" "}
        {Math.abs(point.lng).toFixed(4)}°{lngHemisphere} ±{Math.round(point.accuracy)}m
      </span>
    </div>
  );
}
