import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/5 bg-card p-4 shadow-sm transition-shadow",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
