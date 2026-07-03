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
    <div className="flex flex-col gap-2.5 rounded-lg border border-white/5 bg-slate-800/50 p-3 sm:flex-row sm:items-center sm:gap-3 sm:py-2.5">
      <div className="flex items-center gap-2.5">
        <GripVertical className="h-4 w-4 shrink-0 text-slate-600" />
        <span className="flex-1 truncate text-sm text-white">{field.label}</span>
        {field.custom && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${field.label}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-500 hover:text-rose sm:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/10 sm:ml-auto">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`min-h-[40px] flex-1 px-2.5 text-xs transition-colors sm:flex-none sm:px-3 ${
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
          className="hidden shrink-0 text-slate-500 hover:text-rose sm:block"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
