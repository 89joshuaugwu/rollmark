import { GripVertical, X } from "lucide-react";
import type { FieldRequirement, SessionField } from "@/types";

const OPTIONS: FieldRequirement[] = ["required", "optional", "off"];

const labelFor: Record<FieldRequirement, string> = {
  required: "Required",
  optional: "Optional",
  off: "Off",
};

export function FieldToggle({
  field,
  onChange,
  onRemove,
}: {
  field: SessionField;
  onChange: (requirement: FieldRequirement) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-slate-800/50 px-3 py-2.5">
      <GripVertical className="h-4 w-4 shrink-0 text-slate-600" />
      <span className="flex-1 truncate text-sm text-white">{field.label}</span>
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/10">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 text-xs transition-colors ${
              field.requirement === opt
                ? opt === "off"
                  ? "bg-slate-600 text-white"
                  : "bg-emerald text-slate-950"
                : "bg-transparent text-text-secondary hover:bg-white/5"
            }`}
          >
            {labelFor[opt]}
          </button>
        ))}
      </div>
      {field.custom && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${field.label}`}
          className="shrink-0 text-slate-500 hover:text-rose"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
