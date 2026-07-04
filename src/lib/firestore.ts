import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  increment,
  writeBatch,
  limit as fsLimit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateQrToken } from "@/lib/qrToken";
import type {
  AttendanceRecord,
  AttendanceSession,
  Course,
  Geofence,
  RosterStudent,
  SessionField,
} from "@/types";

const coursesCol = collection(db, "courses");
const sessionsCol = collection(db, "sessions");
const recordsCol = collection(db, "attendanceRecords");

function rosterCol(courseId: string) {
  return collection(db, "courses", courseId, "roster");
}

/**
 * Normalizes a raw session doc into the current shape. Handles two legacy
 * cases from before the mode -> requireGeofence migration:
 *  - old docs have `mode: "STRICT" | "PERMISSIVE"` and no `requireGeofence`
 *  - new docs have `requireGeofence` directly
 * so existing live sessions in Firestore don't need a manual data migration.
 */
function normalizeSession(id: string, data: Record<string, unknown>): AttendanceSession {
  const legacyMode = data.mode as string | undefined;
  const requireGeofence =
    typeof data.requireGeofence === "boolean" ? data.requireGeofence : legacyMode === "STRICT";
  return {
    id,
    lecturerId: data.lecturerId as string,
    courseId: data.courseId as string,
    courseCode: data.courseCode as string,
    courseName: data.courseName as string,
    requireGeofence,
    fields: data.fields as SessionField[],
    date: data.date as string,
    startTime: data.startTime as string,
    endTime: data.endTime as string,
    geofence: data.geofence as Geofence | undefined,
    qrToken: data.qrToken as string,
    qrTokenUpdatedAt: data.qrTokenUpdatedAt as number,
    status: data.status as "active" | "ended",
    createdAt: data.createdAt as number,
    studentsMarked: (data.studentsMarked as number) ?? 0,
  };
}

function generateShareSlug(code: string): string {
  const base = code.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "course";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ---------- Courses ----------

export async function createCourse(
  lecturerId: string,
  code: string,
  name: string
): Promise<string> {
  const ref = await addDoc(coursesCol, {
    lecturerId,
    code: code.toUpperCase(),
    name,
    rosterCount: 0,
    shareSlug: generateShareSlug(code),
    shareGeofenceEnabled: false,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function getCourses(lecturerId: string): Promise<Course[]> {
  const q = query(coursesCol, where("lecturerId", "==", lecturerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Course, "id">) }));
}

/**
 * Roster lives in a `courses/{courseId}/roster/{regNumber}` subcollection
 * (doc ID = reg number, so lookups during attendance validation are a
 * single `get()` rather than a query). Firestore batches cap at 500 writes,
 * so large rosters are chunked.
 */
export async function uploadRoster(courseId: string, roster: RosterStudent[]) {
  const CHUNK_SIZE = 450; // leave headroom under the 500 write-per-batch cap
  for (let i = 0; i < roster.length; i += CHUNK_SIZE) {
    const chunk = roster.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((student) => {
      const ref = doc(rosterCol(courseId), student.regNumber.toUpperCase());
      batch.set(ref, student);
    });
    await batch.commit();
  }
  await updateDoc(doc(coursesCol, courseId), { rosterCount: roster.length });
}

export async function getRoster(courseId: string): Promise<RosterStudent[]> {
  const snap = await getDocs(rosterCol(courseId));
  return snap.docs.map((d) => d.data() as RosterStudent);
}

export async function deleteCourse(courseId: string) {
  const rosterSnap = await getDocs(rosterCol(courseId));
  if (!rosterSnap.empty) {
    const batch = writeBatch(db);
    rosterSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(coursesCol, courseId));
}

/**
 * Updates the course's static share-link settings. `geofence` is optional
 * and, per the Firestore-hates-`undefined` lesson from the PERMISSIVE-mode
 * bug, is only included in the update payload when actually provided —
 * never spread in as an explicit `undefined` value.
 */
/**
 * Backfill for courses created before the share-link feature existed —
 * `createCourse` always sets `shareSlug` now, but older course docs won't
 * have one. Called lazily from CourseList the first time a lecturer opens
 * the share settings for an old course.
 */
export async function ensureCourseShareSlug(courseId: string, code: string): Promise<string> {
  const slug = generateShareSlug(code);
  await updateDoc(doc(coursesCol, courseId), { shareSlug: slug });
  return slug;
}

export async function setCourseShareSettings(
  courseId: string,
  settings: { enabled: boolean; geofence?: Geofence }
) {
  await updateDoc(doc(coursesCol, courseId), {
    shareGeofenceEnabled: settings.enabled,
    ...(settings.geofence !== undefined ? { shareGeofence: settings.geofence } : {}),
  });
}

// ---------- Sessions ----------

interface CreateSessionInput {
  lecturerId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  requireGeofence: boolean;
  fields: SessionField[];
  date: string;
  startTime: string;
  endTime: string;
  geofence?: Geofence;
}

export async function createSession(input: CreateSessionInput): Promise<string> {
  const ref = await addDoc(sessionsCol, {
    ...input,
    qrToken: generateQrToken(),
    qrTokenUpdatedAt: Date.now(),
    status: "active",
    createdAt: Date.now(),
    studentsMarked: 0,
  });
  return ref.id;
}

export function subscribeToSession(
  sessionId: string,
  cb: (session: AttendanceSession | null) => void
) {
  return onSnapshot(doc(sessionsCol, sessionId), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb(normalizeSession(snap.id, snap.data()));
  });
}

export async function getSession(sessionId: string): Promise<AttendanceSession | null> {
  const snap = await getDoc(doc(sessionsCol, sessionId));
  if (!snap.exists()) return null;
  return normalizeSession(snap.id, snap.data());
}

export async function rotateQrToken(sessionId: string) {
  await updateDoc(doc(sessionsCol, sessionId), {
    qrToken: generateQrToken(),
    qrTokenUpdatedAt: Date.now(),
  });
}

export async function updateGeofence(sessionId: string, geofence: Geofence) {
  await updateDoc(doc(sessionsCol, sessionId), { geofence });
}

export async function endSession(sessionId: string) {
  await updateDoc(doc(sessionsCol, sessionId), { status: "ended" });
}

export async function listSessions(
  lecturerId: string,
  opts?: { courseId?: string; max?: number }
): Promise<AttendanceSession[]> {
  const clauses = [where("lecturerId", "==", lecturerId)];
  if (opts?.courseId) clauses.push(where("courseId", "==", opts.courseId));
  const q = query(sessionsCol, ...clauses, orderBy("createdAt", "desc"), fsLimit(opts?.max ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeSession(d.id, d.data()));
}

// ---------- Attendance records ----------
// Student submissions no longer write here directly from the client — see
// src/app/api/attend/[sessionId]/route.ts, which validates server-side via
// firebase-admin and is the only writer for anonymous student submissions.
// The functions below are for the authenticated lecturer's own actions
// (manual add, remove, flag) against records they own.

export async function markAttendanceManually(input: {
  sessionId: string;
  lecturerId: string;
  courseCode: string;
  regNumber: string;
  firstName: string;
  surname: string;
}): Promise<void> {
  await addDoc(recordsCol, {
    sessionId: input.sessionId,
    lecturerId: input.lecturerId,
    courseCode: input.courseCode,
    regNumber: input.regNumber.trim().toUpperCase(),
    firstName: input.firstName.trim(),
    surname: input.surname.trim(),
    middleName: "",
    phone: "",
    email: "",
    location: null,
    distanceFromLecturerMeters: null,
    deviceFingerprint: "manual",
    flagged: false,
    flagReason: "",
    markedManually: true,
    submittedAt: Date.now(),
  });
  await updateDoc(doc(sessionsCol, input.sessionId), { studentsMarked: increment(1) });
}

export function subscribeToRecords(
  sessionId: string,
  cb: (records: AttendanceRecord[]) => void
) {
  const q = query(recordsCol, where("sessionId", "==", sessionId), orderBy("submittedAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, "id">) })));
  });
}

export async function removeAttendanceRecord(recordId: string, sessionId: string) {
  await deleteDoc(doc(recordsCol, recordId));
  await updateDoc(doc(sessionsCol, sessionId), { studentsMarked: increment(-1) });
}

export async function flagAttendanceRecord(recordId: string, reason: string) {
  await updateDoc(doc(recordsCol, recordId), { flagged: true, flagReason: reason });
}

export async function unflagAttendanceRecord(recordId: string) {
  await updateDoc(doc(recordsCol, recordId), { flagged: false, flagReason: "" });
}

export async function getAllRecordsForLecturer(
  lecturerId: string,
  opts?: { courseCode?: string; max?: number }
): Promise<AttendanceRecord[]> {
  const clauses = [where("lecturerId", "==", lecturerId)];
  if (opts?.courseCode) clauses.push(where("courseCode", "==", opts.courseCode));
  const q = query(recordsCol, ...clauses, orderBy("submittedAt", "desc"), fsLimit(opts?.max ?? 500));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, "id">) }));
}
