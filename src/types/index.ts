export type FieldRequirement = "required" | "optional" | "off";

export interface SessionField {
  key: string;
  label: string;
  requirement: FieldRequirement;
  custom?: boolean;
}

export const DEFAULT_SESSION_FIELDS: SessionField[] = [
  { key: "surname", label: "Surname", requirement: "required" },
  { key: "firstName", label: "First Name", requirement: "required" },
  { key: "middleName", label: "Middle Name", requirement: "off" },
  { key: "regNumber", label: "Reg Number", requirement: "required" },
  { key: "phone", label: "Phone", requirement: "required" },
  { key: "email", label: "Email", requirement: "off" },
];

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface Geofence {
  center: GeoPoint;
  radiusMeters: number;
}

export interface AttendanceSession {
  id: string;
  lecturerId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  // Replaces the old `mode: "STRICT" | "PERMISSIVE"` enum. Every usage of
  // `mode` across the app only ever checked one thing — whether geofencing
  // was enforced at attendance-marking time. QR rotation and fingerprinting
  // always ran regardless of mode, so the enum was hiding a single boolean.
  // Kept as a plain flag so it composes independently with the course-level
  // share-link geofence toggle instead of needing a third enum value.
  requireGeofence: boolean;
  fields: SessionField[];
  date: string; // ISO date
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  geofence?: Geofence;
  qrToken: string;
  qrTokenUpdatedAt: number;
  status: "active" | "ended";
  createdAt: number;
  studentsMarked: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  lecturerId: string;
  courseCode: string;
  regNumber: string;
  firstName: string;
  surname: string;
  middleName?: string;
  phone?: string;
  email?: string;
  location?: GeoPoint;
  distanceFromLecturerMeters?: number;
  deviceFingerprint?: string;
  flagged?: boolean;
  flagReason?: string;
  markedManually?: boolean;
  submittedAt: number;
}

export interface Course {
  id: string;
  lecturerId: string;
  code: string;
  name: string;
  rosterCount: number;
  // Static share-link fields (see /s/[slug]). Lives on the course, not the
  // session, since the whole point is a link the lecturer posts once to the
  // class group forever — it always resolves to whichever session on this
  // course is currently live, so it never needs regenerating per class.
  shareSlug: string;
  shareGeofenceEnabled: boolean;
  shareGeofence?: Geofence;
  createdAt: number;
}

export interface RosterStudent {
  regNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface LecturerProfile {
  uid: string;
  name: string;
  email: string;
  department?: string;
  photoURL?: string;
  notifications: {
    sessionEndEmail: boolean;
    duplicateDeviceAlert: boolean;
    weeklySummary: boolean;
  };
}

export type ToastVariant = "success" | "error" | "info";
