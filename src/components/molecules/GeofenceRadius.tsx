import { Slider } from "@/components/ui/Slider";

export function GeofenceRadius({
  value,
  onChange,
}: {
  value: number;
  onChange: (meters: number) => void;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-slate-800/50 p-4">
      <Slider
        label="Geofence radius"
        valueLabel={`${value}m`}
        min={30}
        max={150}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1 flex justify-between text-[11px] text-text-secondary">
        <span>30m — tight</span>
        <span>150m — lecture hall</span>
      </div>
      <p className="mt-3 text-xs text-amber">
        💡 A typical lecture theatre is 60–100m across. Set this wide enough to cover the room but
        tight enough to keep students outside the building from marking in.
      </p>
    </div>
  );
}
