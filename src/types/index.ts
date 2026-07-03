export type SessionMode = "STRICT" | "PERMISSIVE";

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

export interface AttendanceSession {
  id: string;
  lecturerId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  mode: SessionMode;
  fields: SessionField[];
  date: string; // ISO date
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  geofence?: {
    center: GeoPoint;
    radiusMeters: number;
  };
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
