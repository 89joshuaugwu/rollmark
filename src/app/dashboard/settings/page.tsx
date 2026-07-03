"use client";

import { useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import {
  sendPasswordResetEmail,
  updatePassword,
  updateProfile as updateAuthProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import { Camera } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { notify } from "@/components/ui/Toast";
import type { LecturerProfile } from "@/types";

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between py-1.5">
      <span className="text-sm text-white">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-emerald"
      />
    </label>
  );
}

function AvatarUploader({ user, photoURL }: { user: User; photoURL: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(photoURL);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      await updateAuthProfile(user, { photoURL: url });
      await updateDoc(doc(db, "lecturers", user.uid), { photoURL: url });
      setPreview(url);
      notify.success("Avatar updated");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => fileInput.current?.click()}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-slate-700"
        aria-label="Change avatar"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local/static asset
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-text-secondary">
            {user.displayName?.[0]?.toUpperCase() ?? "?"}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
          <Camera className="h-5 w-5 text-white" />
        </span>
      </button>
      <div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          loading={uploading}
          onClick={() => fileInput.current?.click()}
        >
          Change avatar
        </Button>
      </div>
    </div>
  );
}

function ChangePassword({ user }: { user: User }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (!user.email) return;
    if (next.length < 6) {
      notify.error("New password should be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      notify.success("Password changed");
      setCurrent("");
      setNext("");
    } catch {
      notify.error("Current password is incorrect");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input
        label="Current password"
        type="password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <Input
        label="New password"
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        hint="At least 6 characters"
      />
      <Button
        variant="secondary"
        fullWidth
        loading={saving}
        disabled={!current || !next}
        onClick={handleChange}
      >
        Change password
      </Button>
    </div>
  );
}

// Keyed by profile.uid from the parent so React remounts this form (with
// fresh initial state) the moment the profile finishes loading, instead of
// syncing local state from a prop via an effect.
function SettingsForm({ user, profile }: { user: User; profile: LecturerProfile }) {
  const [name, setName] = useState(profile.name);
  const [department, setDepartment] = useState(profile.department ?? "");
  const [notifications, setNotifications] = useState(profile.notifications);
  const [saving, setSaving] = useState(false);

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === "password");

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "lecturers", profile.uid), { name, department, notifications });
      await updateAuthProfile(user, { displayName: name });
      notify.success("Profile updated");
    } catch {
      notify.error("Couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      notify.success("Password reset email sent");
    } catch {
      notify.error("Couldn't send reset email");
    }
  };

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-white">Profile</h3>
        <div className="space-y-4">
          <AvatarUploader user={user} photoURL={profile.photoURL ?? ""} />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" value={user.email ?? ""} disabled />
          <Input
            label="Department (optional)"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Computer Science"
          />
          <Button onClick={saveProfile} loading={saving}>
            Save changes
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Notifications</h3>
        <div className="divide-y divide-white/5">
          <ToggleRow
            label="Email when session ends"
            checked={notifications.sessionEndEmail}
            onChange={(v) => setNotifications((p) => ({ ...p, sessionEndEmail: v }))}
          />
          <ToggleRow
            label="Notify on duplicate device detected"
            checked={notifications.duplicateDeviceAlert}
            onChange={(v) => setNotifications((p) => ({ ...p, duplicateDeviceAlert: v }))}
          />
          <ToggleRow
            label="Weekly attendance summary"
            checked={notifications.weeklySummary}
            onChange={(v) => setNotifications((p) => ({ ...p, weeklySummary: v }))}
          />
        </div>
        <Button onClick={saveProfile} loading={saving} variant="secondary" className="mt-3">
          Save preferences
        </Button>
      </Card>

      <Card className="border-rose/20">
        <h3 className="mb-3 text-sm font-semibold text-rose">Danger zone</h3>
        <div className="space-y-4">
          {hasPasswordProvider ? (
            <ChangePassword user={user} />
          ) : (
            <p className="text-xs text-text-secondary">
              You signed in with Google, so there&apos;s no password to change here.
            </p>
          )}
          <Button variant="secondary" fullWidth onClick={handleResetPassword}>
            Send password reset email
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={() =>
              notify.info("Contact support to delete your account and all associated data")
            }
          >
            Delete account
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { user, profile } = useAuth();

  if (!profile || !user) return <Spinner label="Loading settings..." />;

  return <SettingsForm key={profile.uid} user={user} profile={profile} />;
}
