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
  RosterStudent,
  SessionField,
  SessionMode,
} from "@/types";

const coursesCol = collection(db, "courses");
const sessionsCol = collection(db, "sessions");
const recordsCol = collection(db, "attendanceRecords");

function rosterCol(courseId: string) {
  return collection(db, "courses", courseId, "roster");
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

// ---------- Sessions ----------

interface CreateSessionInput {
  lecturerId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  mode: SessionMode;
  fields: SessionField[];
  date: string;
  startTime: string;
  endTime: string;
  geofence?: AttendanceSession["geofence"];
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
    cb({ id: snap.id, ...(snap.data() as Omit<AttendanceSession, "id">) });
  });
}

export async function getSession(sessionId: string): Promise<AttendanceSession | null> {
  const snap = await getDoc(doc(sessionsCol, sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<AttendanceSession, "id">) };
}

export async function rotateQrToken(sessionId: string) {
  await updateDoc(doc(sessionsCol, sessionId), {
    qrToken: generateQrToken(),
    qrTokenUpdatedAt: Date.now(),
  });
}

export async function updateGeofence(
  sessionId: string,
  geofence: AttendanceSession["geofence"]
) {
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
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceSession, "id">) }));
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
