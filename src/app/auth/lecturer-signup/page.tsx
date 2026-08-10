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

const SCHOOL_EMAIL_PATTERN = /@.+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$/i;

function firebaseErrorMessage(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LecturerSignupPage() {
  const router = useRouter();
  const { signUpEmail, signInGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const notSchoolEmail = email.length > 3 && !SCHOOL_EMAIL_PATTERN.test(email);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await signUpEmail(email, password, name);
      notify.success("Account created");
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
      notify.success("Account created");
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
          <h2 className="text-2xl font-bold">Create your account</h2>
          <p className="mt-1.5 text-sm text-text-secondary">
            Set up attendance sessions for your courses in minutes.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              label="Full name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu.ng"
              hint={
                notSchoolEmail
                  ? "This doesn't look like a university email — you can still continue."
                  : undefined
              }
            />
            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            <Input
              label="Confirm password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              error={error}
            />
            <Button type="submit" fullWidth loading={loading}>
              Create account
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
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{" "}
            <Link href="/auth/lecturer-login" className="font-medium text-emerald">
              Log in
            </Link>
          </p>
        </motion.div>
      </div>
    </PublicShell>
  );
}
