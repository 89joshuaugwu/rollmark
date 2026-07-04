"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import type { LecturerProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: LecturerProfile | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureLecturerDoc(user: User): Promise<LecturerProfile> {
  const ref = doc(db, "lecturers", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as LecturerProfile;

  const profile: LecturerProfile = {
    uid: user.uid,
    name: user.displayName ?? "Lecturer",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    notifications: {
      sessionEndEmail: true,
      duplicateDeviceAlert: true,
      weeklySummary: true,
    },
  };
  await setDoc(ref, profile);
  return profile;
}

/**
 * The Firebase client SDK's own auth state lives in IndexedDB and isn't
 * visible to Next.js server components / middleware. This mirrors it into
 * an httpOnly cookie so `middleware.ts` and `dashboard/layout.tsx` can
 * gate access server-side instead of only in the browser after hydration.
 */
async function syncSessionCookie(user: User | null): Promise<void> {
  if (user) {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // Surfaced (not swallowed): without this, a failed cookie sync looks
      // identical to a successful login from the UI's perspective — you get
      // the success toast, then middleware silently bounces you back to
      // /auth/lecturer-login because the httpOnly session cookie was never
      // set. Throwing here lets the caller (signInEmail/signUpEmail/
      // signInGoogle) catch it and show a real error instead.
      throw new Error(body?.error ?? `Session sync failed (${res.status})`);
    }
  } else {
    await fetch("/api/auth/session", { method: "DELETE" });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await ensureLecturerDoc(u);
        setProfile(p);
        try {
          await syncSessionCookie(u);
        } catch (err) {
          // This background sync (distinct from the explicit call inside
          // signInEmail/signUpEmail/signInGoogle) must not throw — it runs
          // on every auth state change, including tab refreshes, with no
          // page-level catch to surface it to. Log it so it still shows up
          // in the browser console instead of failing invisibly.
          console.error("Session cookie sync failed:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    signInEmail: async (email, password) => {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await syncSessionCookie(cred.user);
    },
    signUpEmail: async (email, password, name) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await ensureLecturerDoc(cred.user);
      await syncSessionCookie(cred.user);
    },
    signInGoogle: async () => {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureLecturerDoc(cred.user);
      await syncSessionCookie(cred.user);
    },
    signOut: async () => {
      await syncSessionCookie(null);
      await fbSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
