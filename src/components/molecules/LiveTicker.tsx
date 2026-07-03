"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Trash2, Flag, FlagOff } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { AttendanceRecord } from "@/types";

export function LiveTicker({
  records,
  onRemove,
  onFlag,
  onUnflag,
}: {
  records: AttendanceRecord[];
  onRemove?: (record: AttendanceRecord) => void;
  onFlag?: (record: AttendanceRecord) => void;
  onUnflag?: (record: AttendanceRecord) => void;
}) {
  if (records.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-secondary">
        No submissions yet — attendance will appear here in real time.
      </p>
    );
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      <AnimatePresence initial={false}>
        {records.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="group flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-slate-800/50 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {r.flagged ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm text-white">
                  {r.surname} {r.firstName}
                  {r.markedManually && (
                    <span className="ml-1.5 text-[10px] text-text-secondary">(manual)</span>
                  )}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {r.regNumber} · {timeAgo(r.submittedAt)}
                  {r.flagged && r.flagReason ? ` · ${r.flagReason}` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
              {onFlag && !r.flagged && (
                <button
                  onClick={() => onFlag(r)}
                  aria-label="Flag as proxy"
                  className="flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-amber/10 hover:text-amber"
                >
                  <Flag className="h-4 w-4" />
                </button>
              )}
              {onUnflag && r.flagged && (
                <button
                  onClick={() => onUnflag(r)}
                  aria-label="Remove flag"
                  className="flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-emerald/10 hover:text-emerald"
                >
                  <FlagOff className="h-4 w-4" />
                </button>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(r)}
                  aria-label="Remove"
                  className="flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-rose/10 hover:text-rose"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
