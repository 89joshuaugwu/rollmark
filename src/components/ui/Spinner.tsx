import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-text-secondary", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-emerald" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
