"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import { QR_ROTATION_MS, msUntilNextRotation } from "@/lib/qrToken";
import { notify } from "@/components/ui/Toast";

/** Remounted (via `key`) whenever qrTokenUpdatedAt changes, so its local
 * countdown state always starts fresh instead of being reset imperatively. */
function RotationCountdown({ qrTokenUpdatedAt }: { qrTokenUpdatedAt: number }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.ceil(msUntilNextRotation(qrTokenUpdatedAt) / 1000)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(Math.ceil(msUntilNextRotation(qrTokenUpdatedAt) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [qrTokenUpdatedAt]);

  const pctLeft = Math.max(0, secondsLeft * 1000) / QR_ROTATION_MS;

  return (
    <div className="flex w-full max-w-[340px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-emerald transition-[width] duration-500 ease-linear"
          style={{ width: `${pctLeft * 100}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-xs text-text-secondary">
        {secondsLeft}s
      </span>
    </div>
  );
}

export function QRDisplay({
  value,
  qrTokenUpdatedAt,
}: {
  value: string;
  qrTokenUpdatedAt: number;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    notify.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center rounded-2xl border-2 border-emerald bg-white p-3 shadow-lg">
        <QRCodeSVG
          value={value}
          size={280}
          level="M"
          fgColor="#0F172A"
          bgColor="#FFFFFF"
          className="h-[70vw] max-h-[320px] w-[70vw] max-w-[320px] md:h-[320px] md:w-[320px]"
        />
      </div>
      <RotationCountdown key={qrTokenUpdatedAt} qrTokenUpdatedAt={qrTokenUpdatedAt} />
      <p className="text-sm text-text-secondary">Scan or refreshes automatically</p>
      <button
        onClick={copyLink}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/10 px-3.5 text-xs text-text-secondary hover:bg-white/5 hover:text-white"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-lime" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
