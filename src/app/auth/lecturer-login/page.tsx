"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { PublicShell } from "@/components/shells/PublicShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/components/ui/Toast";

function firebaseErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LecturerLoginPage() {
  const router = useRouter();
  const { signInEmail, signInGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInEmail(email, password);
      notify.success("Welcome back");
      router.push("/dashboard");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(firebaseErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInGoogle();
      notify.success("Welcome back");
      router.push("/dashboard");
    } catch {
      notify.error("Google sign-in failed. Try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <PublicShell>
      <div className="flex min-h-[calc(100vh-72px)] w-full max-w-md flex-col justify-center py-8 md:max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <Image src="/logo.svg" alt="RollMark" width={26} height={26} />
            <span className="text-lg font-bold">RollMark</span>
          </div>
          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="mt-1.5 text-sm text-text-secondary">
            Log in to manage your attendance sessions.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu.ng"
            />
            <Input
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              error={error}
            />
            <Button type="submit" fullWidth loading={loading}>
              Log in
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-text-secondary">or continue with</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Button
            variant="secondary"
            fullWidth
            loading={googleLoading}
            onClick={handleGoogle}
            type="button"
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link href="/auth/lecturer-signup" className="font-medium text-emerald">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </PublicShell>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.42 3.58v3h3.91c2.29-2.11 3.53-5.22 3.53-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.91-3c-1.08.72-2.47 1.16-4.02 1.16-3.09 0-5.71-2.09-6.64-4.89H1.32v3.09C3.29 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.36 14.36A7.19 7.19 0 015 12c0-.82.14-1.62.36-2.36V6.55H1.32A11.98 11.98 0 000 12c0 1.93.46 3.76 1.32 5.45l4.04-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.35.61 4.6 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.29 2.7 1.32 6.55l4.04 3.09C6.29 6.84 8.91 4.75 12 4.75z"
      />
    </svg>
  );
}
