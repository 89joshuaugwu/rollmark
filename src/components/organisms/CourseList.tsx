"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Upload, Trash2, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { notify } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { getCourses, createCourse, uploadRoster, deleteCourse } from "@/lib/firestore";
import type { Course, RosterStudent } from "@/types";

function parseRosterCsv(text: string): RosterStudent[] {
  const lines = text.trim().split(/\r?\n/);
  const [header, ...rows] = lines;
  const cols = header.toLowerCase().split(",").map((c) => c.trim());
  const idx = {
    regNumber: cols.indexOf("regnumber"),
    firstName: cols.indexOf("firstname"),
    lastName: cols.indexOf("lastname"),
    email: cols.indexOf("email"),
  };
  return rows
    .filter((r) => r.trim().length > 0)
    .map((row) => {
      const cells = row.split(",").map((c) => c.trim());
      return {
        regNumber: cells[idx.regNumber] ?? "",
        firstName: cells[idx.firstName] ?? "",
        lastName: cells[idx.lastName] ?? "",
        email: idx.email >= 0 ? cells[idx.email] : undefined,
      };
    })
    .filter((s) => s.regNumber);
}

export function CourseList() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const refresh = () => {
    if (!user) return;
    getCourses(user.uid)
      .then(setCourses)
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [user]);

  const handleAdd = async () => {
    if (!user || !code.trim() || !name.trim()) return;
    setSaving(true);
    try {
      await createCourse(user.uid, code, name);
      notify.success("Course added");
      setShowAdd(false);
      setCode("");
      setName("");
      refresh();
    } catch {
      notify.error("Couldn't add course");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!confirm("Delete this course? This won't delete past attendance records.")) return;
    await deleteCourse(courseId);
    refresh();
  };

  const handleFileChange = async (courseId: string, file: File) => {
    setUploadingFor(courseId);
    try {
      const text = await file.text();
      const roster = parseRosterCsv(text);
      if (roster.length === 0) {
        notify.error("No valid rows found. Check the CSV format.");
        return;
      }
      await uploadRoster(courseId, roster);
      notify.success(`Matched ${roster.length} students`);
      refresh();
    } catch {
      notify.error("Couldn't read that file");
    } finally {
      setUploadingFor(null);
    }
  };

  if (loading) return <Spinner label="Loading courses..." />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My courses</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          New course
        </Button>
      </div>

      {courses.length === 0 ? (
        <Card className="flex flex-col items-center py-10 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-text-secondary" />
          <p className="font-medium text-white">No courses yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Add a course to start creating attendance sessions.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {c.code} — {c.name}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Students on roster: {c.rosterCount}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  aria-label="Delete course"
                  className="shrink-0 rounded-md p-1.5 text-text-secondary hover:bg-rose/10 hover:text-rose"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3">
                <input
                  ref={(el) => {
                    fileInputs.current[c.id] = el;
                  }}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(c.id, file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="secondary"
                  loading={uploadingFor === c.id}
                  onClick={() => fileInputs.current[c.id]?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload roster
                </Button>
                <p className="mt-1.5 text-[11px] text-text-secondary">
                  💡 CSV format: regNumber,firstName,lastName,email
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add course">
        <div className="space-y-3">
          <Input label="Course code" placeholder="CSC101" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input
            label="Course name"
            placeholder="Introduction to Computer Science"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button fullWidth loading={saving} onClick={handleAdd}>
            Save course
          </Button>
        </div>
      </Modal>
    </div>
  );
}
