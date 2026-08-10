import Link from "next/link";
import { ShieldCheck, Smartphone, BarChart3, ScanLine, ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/shells/PublicShell";
import { Button } from "@/components/ui/Button";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Geofence + QR",
    body: "Rotating QR codes plus optional live-location matching make proxy attendance practically impossible.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first",
    body: "Built for the phone in your pocket — fast to load, easy to tap, works on any campus network.",
  },
  {
    icon: BarChart3,
    title: "Real-time analytics",
    body: "See trends as they happen and catch at-risk students before the semester report does.",
  },
];

export default function LandingPage() {
  return (
    <PublicShell>
      <section className="mx-auto flex max-w-3xl flex-col items-center py-14 text-center md:py-24">
        <div className="mb-5 flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-3 py-1 text-xs font-medium text-emerald">
          <ScanLine className="h-3.5 w-3.5" />
          Built for Nigerian universities
        </div>
        <h1 className="text-3xl font-bold leading-tight md:text-5xl">
          Attendance. <span className="text-emerald">Reimagined.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-text-secondary md:text-lg">
          Fast, fraud-proof QR-based attendance for lecturers and students — no more shouting out
          reg numbers, no more signing for your coursemate.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/auth/lecturer-signup">
            <Button className="px-8">
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/auth/lecturer-login">
            <Button variant="secondary" className="px-8">
              I already have an account
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 pb-16 md:grid-cols-3 md:gap-6 md:pb-24">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-lg border border-white/5 bg-card p-5 transition-colors hover:border-emerald/30"
          >
            <Icon className="mb-3 h-6 w-6 text-emerald" />
            <h3 className="mb-1.5 font-semibold text-white">{title}</h3>
            <p className="text-sm text-text-secondary">{body}</p>
          </div>
        ))}
      </section>

      <footer className="w-full max-w-5xl border-t border-white/5 py-6 text-center text-xs text-text-secondary">
        <p>© {new Date().getFullYear()} RollMark. All rights reserved.</p>
      </footer>
    </PublicShell>
  );
}
