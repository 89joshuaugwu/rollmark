# RollMark — CONTEXT.md

Technical architecture reference. Pair with `DESIGN.md` (visual/UX spec) when prompting Antigravity — DESIGN.md says what it looks like, this says how it works.

---

## 1. Tech Stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) | Server Actions for mutations, API routes only where server-only secrets are needed |
| Language | TypeScript (strict mode) | No `any` in submission/validation logic — this is the fraud-prevention core |
| Styling | Tailwind CSS v4 | CSS variables per DESIGN.md Section 9 |
| UI motion | Framer Motion 11.x | |
| Auth | Firebase Auth (email/password + Google) | Lecturers only — students never authenticate |
| Database | Firestore (primary) + Realtime Database (live ticker presence) | See schema below |
| File storage | Cloudinary | Avatars, optional future selfie-at-checkin |
| Email | Nodemailer + Gmail SMTP (16-digit app password) | Session-end, fraud alerts, weekly summary |
| Fingerprinting | `@fingerprintjs/fingerprintjs` (open-source) | Client-only, no server auth needed |
| QR generation | `qrcode.react` | Client-rendered from token string |
| Charts | Recharts | Attendance trend, analytics |
| CSV | PapaParse | Roster upload + export |
| PDF | jsPDF + jspdf-autotable | Session/records export |
| Hosting | Vercel | Push to GitHub → auto-deploy |

---

## 2. Firestore Data Model

```
/lecturers/{uid}
  uid: string
  email: string
  displayName: string
  approved: boolean              // true by default; false only if admin-approval mode enabled
  notificationPrefs: {
    sessionEnded: boolean
    duplicateDeviceAlert: boolean
    weeklySummary: boolean
  }
  createdAt: timestamp

/lecturers/{uid}/courses/{courseId}
  courseCode: string              // "CSC101"
  courseName: string              // "Intro to Computer Science"
  rosterCount: number
  createdAt: timestamp

/lecturers/{uid}/courses/{courseId}/roster/{regNumber}
  regNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string

/sessions/{sessionId}
  sessionId: string
  courseId: string
  lecturerId: string               // matches lecturers/{uid}
  authMode: "STRICT" | "PERMISSIVE"
  requireGeofence: boolean

  // STRICT mode only:
  lecturerLocation: { lat: number, lng: number } | null
  geofenceRadius: number | null    // meters, 30-150, default 50

  // Rotating QR:
  qrToken: string                  // regenerated every 15s
  qrTokenExpiresAt: timestamp

  fields: [
    { key: string, label: string, type: "text"|"number"|"select", required: boolean, order: number }
  ]

  startTime: timestamp
  endTime: timestamp
  active: boolean

  submissions: [
    {
      regNumber: string
      data: { [fieldKey: string]: string }   // captured field values
      fingerprint: string
      location: { lat: number, lng: number, accuracy: number } | null
      submittedAt: timestamp
      qrUsed: string                          // which token rotation it used
      manual: boolean                         // true if lecturer added manually
      flagged: boolean                        // true if fraud signal detected
    }
  ]

  createdAt: timestamp
```

**Why `submissions` as an array on the session doc, not a subcollection:**
Sessions are short-lived (one lecture, ~1-2 hours) and submission counts are small (tens to low hundreds). Array + `arrayUnion` gives free real-time listening on the single doc for the live ticker without N separate listeners. If you later need cross-session querying at scale, migrate to a subcollection — not needed at final-year-project scale.

---

## 3. Validation Logic (server-side, non-negotiable)

This runs in `/app/api/attend/route.ts` using `firebase-admin` — **never trust client-side checks alone**, the client-side geofence/fingerprint reads are UX feedback only.

```typescript
async function validateAttendance(
  sessionId: string,
  submission: {
    regNumber: string;
    data: Record<string, string>;
    fingerprint: string;
    location?: { lat: number; lng: number; accuracy: number };
    qrToken: string;
  }
) {
  const sessionRef = db.collection("sessions").doc(sessionId);
  const session = await sessionRef.get();

  if (!session.exists) throw new Error("Session not found.");
  const data = session.data()!;

  if (!data.active) throw new Error("This session has ended.");

  // 1. QR token check
  if (submission.qrToken !== data.qrToken) {
    throw new Error("This QR code has expired. Please rescan.");
  }

  // 2. Geofence check (STRICT only)
  if (data.requireGeofence) {
    if (!submission.location) {
      throw new Error("Location required for this session. Enable in browser settings.");
    }
    const distance = haversine(data.lecturerLocation, submission.location);
    if (distance > data.geofenceRadius) {
      throw new Error(`You are ${Math.round(distance)}m away. Move closer.`);
    }
  }

  // 3. Roster validation (if course has a roster)
  const rosterDoc = await db
    .collection("lecturers").doc(data.lecturerId)
    .collection("courses").doc(data.courseId)
    .collection("roster").doc(submission.regNumber)
    .get();
  const courseDoc = await db
    .collection("lecturers").doc(data.lecturerId)
    .collection("courses").doc(data.courseId).get();
  if (courseDoc.data()?.rosterCount > 0 && !rosterDoc.exists) {
    throw new Error("Registration number not recognized.");
  }

  // 4. Already-submitted check
  const alreadySubmitted = (data.submissions || []).some(
    (s: any) => s.regNumber === submission.regNumber
  );
  if (alreadySubmitted) {
    throw new Error("Your registration number already marked present.");
  }

  // 5. Fingerprint fraud flag (soft — log, don't block)
  let flagged = false;
  const sameDevice = (data.submissions || []).find(
    (s: any) => s.fingerprint === submission.fingerprint
  );
  if (sameDevice && sameDevice.regNumber !== submission.regNumber) {
    flagged = true;
    console.warn(
      `[FRAUD] Session ${sessionId}: fingerprint ${submission.fingerprint} used for both ${sameDevice.regNumber} and ${submission.regNumber}`
    );
  }

  // 6. Write
  const record = {
    regNumber: submission.regNumber,
    data: submission.data,
    fingerprint: submission.fingerprint,
    location: submission.location ?? null,
    submittedAt: Timestamp.now(),
    qrUsed: submission.qrToken,
    manual: false,
    flagged,
  };

  await sessionRef.update({
    submissions: FieldValue.arrayUnion(record),
  });

  return { success: true, flagged };
}
```

### Haversine distance function

```typescript
function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
```

---

## 4. QR Token Rotation

- Client (lecturer's live session page) runs a `setInterval` every 15s
- On each tick: generate a new short token (`nanoid(10)`), call a Server Action that updates `/sessions/{sessionId}.qrToken` and `.qrTokenExpiresAt`
- QR component re-renders with the new URL: `https://rollmark.vercel.app/attend/{sessionId}?t={newToken}`
- Old tokens are immediately invalid — any in-flight submission using a stale token fails validation step 1 above, student sees "This QR code has expired. Please rescan."
- **PERMISSIVE mode still rotates the QR** — rotation isn't a geofence substitute, but it does mean a screenshot shared in a WhatsApp group dies within 15s, which raises the bar even without location checks.

---

## 5. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /lecturers/{uid} {
      allow read, update: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid;

      match /courses/{courseId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;

        match /roster/{regNumber} {
          allow read, write: if request.auth != null && request.auth.uid == uid;
        }
      }
    }

    match /sessions/{sessionId} {
      // Lecturer can read/write their own sessions
      allow read: if request.auth != null && request.auth.uid == resource.data.lecturerId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.lecturerId;
      allow update: if request.auth != null && request.auth.uid == resource.data.lecturerId;

      // Public read is NOT allowed directly — students submit via the
      // /api/attend server route using firebase-admin (bypasses client rules
      // entirely, which is correct: validation logic must run server-side).
    }
  }
}
```

⚠️ **Always flag:** these rules require a manual paste-and-publish in the Firebase Console every time they change. No CLI/CI automation for this in the current setup — budget it into every deploy that touches permissions.

---

## 6. Environment Variables

```
# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server only)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_UPLOAD_PRESET=

# Gmail SMTP
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=          # 16-digit app password, not account password

# App
NEXT_PUBLIC_APP_URL=https://rollmark.vercel.app
```

---

## 7. Two-Mode Decision Summary (reference for AI agent)

| | STRICT | PERMISSIVE |
|---|---|---|
| Geofence check | Yes — reject if outside radius | No |
| QR rotation | Yes (15s) | Yes (15s) |
| Fingerprint dup check | Flag, don't block | Flag, don't block |
| Roster validation | Optional (if roster uploaded) | Optional (if roster uploaded) |
| Lecturer must be physically present | Effectively yes (sets location) | No |
| Best for | In-class-only lecturers | Hybrid/flexible courses |

---

## 8. Non-Goals (explicitly out of scope for defense build)

- No student accounts/login — by design, per the original scope discussion
- No native mobile app — mobile-first responsive web only
- No biometric verification — fingerprint here means *device* fingerprint, not fingerprint scanning
- No offline-first architecture — requires internet for Firestore; acceptable for campus wifi/data context
- Admin multi-lecturer oversight — build only if time permits after Phase 8; not core to case study defense
