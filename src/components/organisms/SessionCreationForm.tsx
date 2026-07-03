"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MapPin, RefreshCw } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FieldToggle } from "@/components/molecules/FieldToggle";
import { GeofenceRadius } from "@/components/molecules/GeofenceRadius";
import { LocationPill } from "@/components/molecules/LocationPill";
import { notify } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { getCourses, createCourse, createSession } from "@/lib/firestore";
import { getCurrentLocation, GeolocationError } from "@/lib/geolocation";
import { DEFAULT_SESSION_FIELDS } from "@/types";
import type { Course, FieldRequirement, GeoPoint, SessionField, SessionMode } from "@/types";

export function SessionCreationForm() {
  const router = useRouter();
  const { user } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseName, setNewCourseName] = useState("");
  const [showNewCourse, setShowNewCourse] = useState(false);

  const [mode, setMode] = useState<SessionMode>("PERMISSIVE");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");

  const [fields, setFields] = useState<SessionField[]>(DEFAULT_SESSION_FIELDS);
  const [customLabel, setCustomLabel] = useState("");

  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [radius, setRadius] = useState(50);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCourses(user.uid).then((c) => {
      setCourses(c);
      if (c.length > 0) setCourseId(c[0].id);
    });
  }, [user]);

  const handleAddCourse = async () => {
    if (!user || !newCourseCode.trim() || !newCourseName.trim()) return;
    const id = await createCourse(user.uid, newCourseCode, newCourseName);
    const course: Course = {
      id,
      lecturerId: user.uid,
      code: newCourseCode.toUpperCase(),
      name: newCourseName,
      rosterCount: 0,
      createdAt: Date.now(),
    };
    setCourses((prev) => [course, ...prev]);
    setCourseId(id);
    setShowNewCourse(false);
    setNewCourseCode("");
    setNewCourseName("");
    notify.success("Course added");
  };

  const updateFieldRequirement = (key: string, requirement: FieldRequirement) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, requirement } : f)));
  };

  const removeCustomField = (key: string) => {
    setFields((prev) => prev.filter((f) => f.key !== key));
  };

  const addCustomField = () => {
    if (!customLabel.trim()) return;
    setFields((prev) => [
      ...prev,
      {
        key: `custom_${Date.now()}`,
        label: customLabel.trim(),
        requirement: "optional",
        custom: true,
      },
    ]);
    setCustomLabel("");
  };

  const captureLocation = async () => {
    setLocating(true);
    setLocationError("");
    try {
      const point = await getCurrentLocation();
      setLocation(point);
    } catch (err) {
      if (err instanceof GeolocationError) {
        setLocationError(
          err.code === "denied"
            ? "Location permission was denied. Enable it in your browser settings."
            : "Could not determine location. Try again."
        );
      }
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    const course = courses.find((c) => c.id === courseId);
    if (!course) {
      notify.error("Select or add a course first");
      return;
    }
    if (mode === "STRICT" && !location) {
      notify.error("Capture your location for a strict session");
      return;
    }

    setSubmitting(true);
    try {
      const sessionId = await createSession({
        lecturerId: user.uid,
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        mode,
        fields,
        date,
        startTime: `${date}T${startTime}:00`,
        endTime: `${date}T${endTime}:00`,
        geofence:
          mode === "STRICT" && location
            ? { center: location, radiusMeters: radius }
            : undefined,
      });
      notify.success("Session created");
      router.push(`/dashboard/sessions/${sessionId}`);
    } catch (err) {
      console.error("Session creation error:", err);
      notify.error("Couldn't create the session. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Mode */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Select mode</h3>
        <div className="space-y-2.5">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 ${
              mode === "STRICT" ? "border-emerald bg-emerald/5" : "border-white/10"
            }`}
          >
            <input
              type="radio"
              name="mode"
              className="mt-1 accent-emerald"
              checked={mode === "STRICT"}
              onChange={() => setMode("STRICT")}
            />
            <div>
              <p className="font-medium text-white">Strict (geofencing required)</p>
              <p className="text-sm text-text-secondary">
                Requires your in-class location. Best for preventing proxy attendance.
              </p>
            </div>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 ${
              mode === "PERMISSIVE" ? "border-emerald bg-emerald/5" : "border-white/10"
            }`}
          >
            <input
              type="radio"
              name="mode"
              className="mt-1 accent-emerald"
              checked={mode === "PERMISSIVE"}
              onChange={() => setMode("PERMISSIVE")}
            />
            <div>
              <p className="font-medium text-white">Permissive (QR only)</p>
              <p className="text-sm text-text-secondary">
                Share the QR anywhere. A rotating code every 30s + device fingerprinting are your
                proxy defense.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Course & timing */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Course & timing</h3>
        <div className="space-y-3">
          {!showNewCourse ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label="Course"
                  required
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  {courses.length === 0 && <option value="">No courses yet</option>}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowNewCourse(true)}
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-white/10 p-3">
              <Input
                label="Course code"
                placeholder="CSC101"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
              />
              <Input
                label="Course name"
                placeholder="Introduction to Computer Science"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="button" onClick={handleAddCourse} className="flex-1">
                  Save course
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNewCourse(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Input
            label="Date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start time"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="End time"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Fields */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Fields to capture</h3>
        <div className="space-y-2">
          {fields.map((field) => (
            <FieldToggle
              key={field.key}
              field={field}
              onChange={(r) => updateFieldRequirement(field.key, r)}
              onRemove={field.custom ? () => removeCustomField(field.key) : undefined}
            />
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="Add custom field (e.g. Level)"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={addCustomField} className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Geofence */}
      {mode === "STRICT" && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Geofence</h3>
          <div className="space-y-3">
            {location ? (
              <div className="flex flex-wrap items-center gap-2">
                <LocationPill point={location} />
                <button
                  type="button"
                  onClick={captureLocation}
                  className="inline-flex items-center gap-1 text-xs text-emerald hover:underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  Recapture
                </button>
              </div>
            ) : (
              <Button type="button" variant="secondary" loading={locating} onClick={captureLocation}>
                <MapPin className="h-4 w-4" />
                Capture location
              </Button>
            )}
            {locationError && <p className="text-sm text-rose">{locationError}</p>}
            <GeofenceRadius value={radius} onChange={setRadius} />
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-16 border-t border-white/5 bg-bg/95 p-4 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-5xl gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="hidden md:inline-flex"
          >
            Cancel
          </Button>
          <Button type="button" fullWidth onClick={handleSubmit} loading={submitting}>
            Create attendance session
          </Button>
        </div>
      </div>
    </div>
  );
}
