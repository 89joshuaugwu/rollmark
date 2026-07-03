"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
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

// Keyed by profile.uid from the parent so React remounts this form (with
// fresh initial state) the moment the profile finishes loading, instead of
// syncing local state from a prop via an effect.
function SettingsForm({ userEmail, profile }: { userEmail: string; profile: LecturerProfile }) {
  const [name, setName] = useState(profile.name);
  const [department, setDepartment] = useState(profile.department ?? "");
  const [notifications, setNotifications] = useState(profile.notifications);
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "lecturers", profile.uid), { name, department, notifications });
      notify.success("Profile updated");
    } catch {
      notify.error("Couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userEmail) return;
    try {
      await sendPasswordResetEmail(auth, userEmail);
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
        <div className="space-y-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" value={userEmail} disabled />
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
        <div className="space-y-2">
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

  return <SettingsForm key={profile.uid} userEmail={user.email ?? ""} profile={profile} />;
}
