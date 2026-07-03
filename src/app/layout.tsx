import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { RollMarkToaster } from "@/components/ui/Toast";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RollMark — Attendance. Reimagined.",
  description:
    "Fast, fraud-proof QR-based attendance for Nigerian university lecturers and students.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F172A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          {children}
          <RollMarkToaster />
        </AuthProvider>
      </body>
    </html>
  );
}
