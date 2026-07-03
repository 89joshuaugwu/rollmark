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
  runTransaction,
  increment,
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
    roster: [] as RosterStudent[],
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

export async function uploadRoster(courseId: string, roster: RosterStudent[]) {
  await updateDoc(doc(coursesCol, courseId), {
    roster,
    rosterCount: roster.length,
  });
}

export async function deleteCourse(courseId: string) {
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

interface SubmitAttendanceInput {
  sessionId: string;
  lecturerId: string;
  courseCode: string;
  regNumber: string;
  firstName: string;
  surname: string;
  middleName?: string;
  phone?: string;
  email?: string;
  location?: AttendanceRecord["location"];
  distanceFromLecturerMeters?: number;
  deviceFingerprint: string;
}

export class DuplicateAttendanceError extends Error {
  constructor() {
    super("You've already marked attendance for this session.");
  }
}

/**
 * Runs as a transaction so two near-simultaneous submits from the same
 * reg number can't both slip through — this is the "already marked
 * present" check from DESIGN.md §5.
 */
export async function submitAttendance(input: SubmitAttendanceInput): Promise<void> {
  const dupQuery = query(
    recordsCol,
    where("sessionId", "==", input.sessionId),
    where("regNumber", "==", input.regNumber.trim().toUpperCase())
  );
  const dupSnap = await getDocs(dupQuery);
  if (!dupSnap.empty) {
    throw new DuplicateAttendanceError();
  }

  // Flag (not block) if this device already marked someone else present
  // in this session.
  const deviceQuery = query(
    recordsCol,
    where("sessionId", "==", input.sessionId),
    where("deviceFingerprint", "==", input.deviceFingerprint)
  );
  const deviceSnap = await getDocs(deviceQuery);
  const flagged = !deviceSnap.empty;

  await runTransaction(db, async (tx) => {
    const newRecordRef = doc(recordsCol);
    tx.set(newRecordRef, {
      sessionId: input.sessionId,
      lecturerId: input.lecturerId,
      courseCode: input.courseCode,
      regNumber: input.regNumber.trim().toUpperCase(),
      firstName: input.firstName.trim(),
      surname: input.surname.trim(),
      middleName: input.middleName?.trim() ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      location: input.location ?? null,
      distanceFromLecturerMeters: input.distanceFromLecturerMeters ?? null,
      deviceFingerprint: input.deviceFingerprint,
      flagged,
      flagReason: flagged ? "Device already used for another student in this session" : "",
      markedManually: false,
      submittedAt: Date.now(),
    });

    const sessionRef = doc(sessionsCol, input.sessionId);
    tx.update(sessionRef, { studentsMarked: increment(1) });
  });
}

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
