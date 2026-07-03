# RollMark — PROMPT.md

Feed these to Antigravity **one phase at a time**. Don't paste the whole file at once — each phase depends on the last being verified working. Reference `DESIGN.md` and `CONTEXT.md` in every prompt (attach both as context files in Antigravity).

---

## PHASE 0 — Project Bootstrap

```
Using DESIGN.md and CONTEXT.md as reference, bootstrap a new Next.js 16 project named "rollmark" with:

- App Router, TypeScript, Tailwind CSS v4
- React 19
- Folder structure:
  /app
    /(public)/page.tsx                    → landing
    /(public)/auth/lecturer-login/page.tsx
    /(public)/auth/lecturer-signup/page.tsx
    /(public)/attend/[sessionId]/page.tsx
    /(dashboard)/dashboard/page.tsx
    /(dashboard)/dashboard/sessions/create/page.tsx
    /(dashboard)/dashboard/sessions/[sessionId]/page.tsx
    /(dashboard)/dashboard/sessions/[sessionId]/history/page.tsx
    /(dashboard)/dashboard/courses/page.tsx
    /(dashboard)/dashboard/records/page.tsx
    /(dashboard)/dashboard/analytics/page.tsx
    /(dashboard)/dashboard/settings/page.tsx
  /components
    /ui           → Button, Input, Card, Badge, Spinner, Toast, Modal, Slider
    /molecules    → LocationPill, QRDisplay, SessionCard, FieldToggle, GeofenceRadius, LiveTicker, StudentRow
    /organisms    → SessionCreationForm, LiveSessionBoard, AttendanceForm, CourseList, AnalyticsDashboard
    /shells       → AppShell, PublicShell
  /lib
    /firebase.ts       → Firebase config + init (client)
    /firebase-admin.ts → Admin SDK init (server actions)
    /geofence.ts       → haversine distance function
    /fingerprint.ts    → FingerprintJS wrapper
    /qr-token.ts       → rotating token generator
  /types
    /session.ts        → Session, Submission, Field types (per CONTEXT.md schema)

Install dependencies: firebase, firebase-admin, framer-motion, recharts, lucide-react,
@fingerprintjs/fingerprintjs, qrcode.react, react-hot-toast, papaparse, date-fns.

Set up Tailwind CSS v4 theme using the exact color tokens from DESIGN.md Section 1
(Emerald #10B981 primary, Slate dark backgrounds, Amber/Rose for warnings/errors).
Dark mode as default — no light mode toggle.

Do NOT scaffold page content yet. Just the folder structure, empty typed components,
Firebase config with placeholder env vars, and a working `npm run dev`.

Output a .env.local.example with all required Firebase + Cloudinary + Gmail SMTP keys.
```

---

## PHASE 1 — Auth (Lecturer Login/Signup)

```
Using DESIGN.md Section "Auth Pages" and CONTEXT.md's auth rules, build:

1. /app/(public)/auth/lecturer-signup/page.tsx
2. /app/(public)/auth/lecturer-login/page.tsx
3. /lib/auth.ts — Firebase Auth helpers (signUpWithEmail, loginWithEmail, loginWithGoogle, logout)
4. /components/shells/PublicShell.tsx

Requirements:
- Email + password signup/login using Firebase Auth
- Google OAuth button (Firebase signInWithPopup)
- On signup: validate email domain matches an educator pattern (configurable list,
  default allow any email but flag non-.edu domains with a soft warning, not a hard block —
  ESUT staff may use Gmail)
- On successful signup: create a /lecturers/{uid} Firestore doc with
  { uid, email, displayName, createdAt, approved: true } (approved defaults true unless
  admin-approval mode is enabled later)
- Mobile-first form layout per DESIGN.md (full-height, centered, 44px inputs, Emerald focus ring)
- Framer Motion page transition (fade + slideUp per DESIGN.md Section 8)
- Error toasts via react-hot-toast for: wrong password, email exists, weak password, network error
- Redirect to /dashboard on success
- Add a middleware.ts that protects all /dashboard/* routes — redirect to
  /auth/lecturer-login if no valid Firebase session cookie

Use complete, deployable files — no placeholders or TODOs left in logic.
```

---

## PHASE 2 — Courses & Roster Upload

```
Using DESIGN.md Section "Courses" and CONTEXT.md's Firestore schema, build:

1. /app/(dashboard)/dashboard/courses/page.tsx
2. /components/organisms/CourseList.tsx
3. /lib/courses.ts — CRUD functions (createCourse, getCourses, updateCourse, deleteCourse, uploadRoster)
4. /components/shells/AppShell.tsx (top bar + bottom nav mobile / sidebar desktop, per DESIGN.md Section 12)

Requirements:
- Firestore collection: /lecturers/{uid}/courses/{courseId}
  Fields: { courseCode, courseName, createdAt, rosterCount }
- Roster sub-collection: /lecturers/{uid}/courses/{courseId}/roster/{regNumber}
  Fields: { regNumber, firstName, lastName, email, phone }
- CSV upload using papaparse — expected format: regNumber,firstName,lastName,email
  On upload: parse, validate rows (reject malformed reg numbers), batch write to Firestore
  (use Firestore batched writes, max 500 per batch), show progress + match count in toast
- Course card UI per DESIGN.md molecule spec — edit/delete/view actions
- Empty state per DESIGN.md Section 16 when no courses exist
- AppShell must wrap all /dashboard/* pages: bottom tab bar on mobile (<768px),
  sidebar on desktop, per DESIGN.md navigation pattern (Dashboard/Sessions/Courses/Records/Settings)

Complete, deployable files. Wire AppShell into the (dashboard) route group layout.tsx.
```

---

## PHASE 3 — Session Creation (Mode Toggle + Field Builder + Geofence)

```
Using DESIGN.md Section "Create Session" and CONTEXT.md's validation logic, build:

1. /app/(dashboard)/dashboard/sessions/create/page.tsx
2. /components/organisms/SessionCreationForm.tsx
3. /components/molecules/FieldToggle.tsx
4. /components/molecules/GeofenceRadius.tsx
5. /lib/sessions.ts — createSession function
6. /lib/qr-token.ts — generateToken(), token rotation scheduler

Requirements:
- Step-by-step form per DESIGN.md wireframe:
  Step 1: Mode radio (STRICT / PERMISSIVE) with the exact copy from DESIGN.md
  Step 2: Course dropdown (pulled from /lecturers/{uid}/courses), date picker, start/end time
  Step 3: Field toggles — Surname, First Name, Middle Name, Reg Number, Phone, Email
           (each: on/off + required/optional radio), plus "+ Add custom field" button
           that appends { key, label, type: 'text', required: boolean } to the fields array
  Step 4 (only if STRICT): "Capture location" button using navigator.geolocation.getCurrentPosition,
           display lat/lng + accuracy per DESIGN.md LocationPill, geofence radius slider
           (30m–150m range, default 50m, per our earlier discussion) with the exact hint text
           "Theater A is ~80m from Theater B"

- On submit: create Firestore doc at /sessions/{sessionId} per CONTEXT.md schema:
  {
    sessionId, courseId, lecturerId, authMode, requireGeofence,
    lecturerLocation: {lat,lng} | null, geofenceRadius: number | null,
    qrToken, qrTokenExpiresAt, fields: [...], startTime, endTime, active: true,
    submissions: []
  }
- Generate initial qrToken (crypto.randomUUID or nanoid, short form)
- Redirect to /dashboard/sessions/[sessionId] on success

Complete, deployable files. All form state client-side with useState/useReducer —
no external form library needed for this complexity level.
```

---

## PHASE 4 — Live Session Board (Rotating QR + Real-Time Ticker)

```
Using DESIGN.md Section "Live Session" and CONTEXT.md's rotation + fraud-flag rules, build:

1. /app/(dashboard)/dashboard/sessions/[sessionId]/page.tsx
2. /components/organisms/LiveSessionBoard.tsx
3. /components/molecules/QRDisplay.tsx
4. /components/molecules/LiveTicker.tsx
5. /lib/qr-rotation.ts — client-side interval that regenerates qrToken every 15s via
   a server action, updates Firestore doc, resets countdown

Requirements:
- QR encodes URL: https://rollmark.vercel.app/attend/{sessionId}?t={qrToken}
  using qrcode.react, styled per DESIGN.md Section 13 (Emerald border, Slate 800 bg,
  80% width mobile / 12cm desktop)
- Countdown timer visually counting down from 15s, resets on each rotation
- If STRICT mode: display LocationPill with lecturer's captured location,
  "Recapture" button to update location mid-session (writes to session doc)
- Live ticker: Firestore onSnapshot listener on /sessions/{sessionId},
  renders submissions array newest-first, green checkmark + name + timestamp,
  swipe-to-reveal Remove/Flag actions (mobile), hover-reveal on desktop
- Toast notification on new submission arriving (react-hot-toast), and a distinct
  warning-styled toast when a submission arrives with `flagged: true`
  ("⚠️ Possible duplicate device detected")
- Manual add-attendance toggle per DESIGN.md — reg number + name inputs, writes directly
  to submissions array with a `manual: true` flag
- "End session" button — confirmation modal, on confirm sets `active: false`,
  stops QR rotation, redirects to /dashboard/sessions/[sessionId]/history

Complete, deployable files. Use Firestore real-time listeners (onSnapshot), not polling.
```

---

## PHASE 5 — Public Attend Page (Geofence + Fingerprint + Submission)

```
Using DESIGN.md Section "Attendance Form" and CONTEXT.md's full validateAttendance logic
(QR token check, geofence check, duplicate reg number check, fingerprint fraud flag), build:

1. /app/(public)/attend/[sessionId]/page.tsx
2. /components/organisms/AttendanceForm.tsx
3. /lib/geofence.ts — haversine(coord1, coord2) → distance in meters
4. /lib/fingerprint.ts — getVisitorId() wrapper around @fingerprintjs/fingerprintjs
5. /app/api/attend/route.ts — POST endpoint running the full validateAttendance
   server-side logic against firebase-admin (never trust client-side validation alone)

Requirements:
- Read sessionId from route param, qrToken from ?t= query param
- Fetch session doc server-side (or via API route) — reject immediately if session
  not found, `active: false`, or current qrToken doesn't match the URL token
  (show "This QR code has expired. Please rescan." per DESIGN.md error states)
- If session.requireGeofence === true:
    Show permission block per DESIGN.md wireframe: "Allow location access?" button
    → navigator.geolocation.getCurrentPosition → live accuracy display
    → if denied: show the exact copy "Location required for this session. Enable in
      browser settings." with no way to bypass
- Render form fields dynamically from session.fields array (respecting required/optional,
  field type, custom fields) — mobile-first, 44px inputs, sticky submit button
- On submit:
    1. Get fingerprint via getVisitorId()
    2. Get final geolocation reading (if STRICT)
    3. POST to /api/attend with { sessionId, qrToken, regNumber, fields data, fingerprint, location }
    4. API route runs full validateAttendance logic (see CONTEXT.md):
       - QR token match
       - geofence distance check (if STRICT) using haversine, reject with exact distance
         in the error message per DESIGN.md: "You are ${distance}m away. Move closer."
       - reg number already submitted → reject "already marked present"
       - fingerprint used under different reg number → allow submission but set
         flagged: true on the record, log a [FRAUD] warning server-side
       - roster validation (if course has a roster): reject unrecognized reg numbers
         with "Registration number not recognized."
    5. On success: Firestore arrayUnion into session.submissions, return 200
- Success state: checkmark animation + confetti (Framer Motion, per DESIGN.md Section 8),
  "Attendance recorded ✓", "You may close this page."
- All error states use the exact copy from DESIGN.md Section "Attendance Form" error states

Complete, deployable files. This is the highest-stakes page — server-side validation
in the API route is non-negotiable, client-side checks are UX only.
```

---

## PHASE 6 — Records, History & Export

```
Using DESIGN.md Sections "Records" and "Live Session → history", build:

1. /app/(dashboard)/dashboard/records/page.tsx
2. /app/(dashboard)/dashboard/sessions/[sessionId]/history/page.tsx
3. /components/molecules/StudentRow.tsx
4. /lib/export.ts — exportToCSV(submissions), exportToPDF(submissions) using a
   lightweight client-side PDF lib (jspdf + jspdf-autotable) or server-side generation

Requirements:
- Records page: search by reg number/name, filter by course + date range,
  desktop table / mobile card list per DESIGN.md responsive spec
- Session history page: full submission list for one session, shows flagged
  entries with a visible warning badge (Rose color), lecturer can review and
  manually unflag or remove
- CSV export: regNumber,firstName,lastName,phone,email,timestamp,status,flagged
- PDF export: formatted report with course name, session date, lecturer name,
  attendance count, full table — suitable for printing/submission to department

Complete, deployable files.
```

---

## PHASE 7 — Analytics & At-Risk Flagging

```
Using DESIGN.md Section "Analytics", build:

1. /app/(dashboard)/dashboard/analytics/page.tsx
2. /components/organisms/AnalyticsDashboard.tsx
3. /lib/analytics.ts — computeAttendanceTrend(courseId), computeAtRiskStudents(courseId, threshold)

Requirements:
- Aggregate all sessions for a course, compute per-student attendance %
  (sessions attended / total sessions in date range)
- Trend chart: attendance rate by week using Recharts LineChart, Emerald stroke,
  Slate grid lines, per DESIGN.md Section 14
- At-risk card: students below a configurable threshold (default 75%), per
  DESIGN.md — clicking opens a modal listing name, reg number, % attendance
- Metrics cards: total sessions, total students marked, avg attendance rate

Complete, deployable files.
```

---

## PHASE 8 — Settings, Notifications & Polish

```
Using DESIGN.md Section "Settings" and CONTEXT.md's Gmail SMTP setup, build:

1. /app/(dashboard)/dashboard/settings/page.tsx
2. /lib/email.ts — Nodemailer + Gmail SMTP (16-digit app password from env),
   sendSessionEndedEmail(), sendDuplicateDeviceAlert(), sendWeeklySummary()
3. /app/api/cron/weekly-summary/route.ts — Vercel Cron endpoint (weekly)

Requirements:
- Profile section: name, email (read-only), department/bio, avatar upload to Cloudinary
- Notification toggles: email on session end, notify on duplicate device flag,
  weekly summary — store prefs on /lecturers/{uid}.notificationPrefs
- Password change flow (Firebase Auth updatePassword, requires re-auth)
- Wire actual email sends into Phase 4/5 logic where flagged: true submissions occur
  (if lecturer has that pref enabled)
- Final pass: verify all Framer Motion animations match DESIGN.md Section 8 exactly,
  verify dark mode color tokens are consistent across every page, run a full
  mobile-viewport audit (320px–768px) checking tap targets are ≥48px everywhere

Complete, deployable files. This is the final polish phase before deploy checklist.
```

---

## Deploy Checklist (run after Phase 8)

```
1. Push to GitHub (89joshuaugwu/rollmark or similar)
2. Connect repo to Vercel, set all env vars from .env.local.example
3. ⚠️ MANUAL STEP — Firebase Console → Firestore Rules → paste rules from
   CONTEXT.md Section "Firestore Security Rules" → click Publish.
   This CANNOT be automated. Do this every time rules change.
4. Firebase Console → Authentication → enable Email/Password + Google providers
5. Firebase Console → Firestore → create composite indexes if prompted by
   console errors (records search by course + date will likely need one)
6. Test full flow on a real phone: create STRICT session → scan QR → geofence
   check → submit → verify live ticker updates → end session → check export
7. Test PERMISSIVE mode: create session → share QR link directly (no scan) →
   submit from a browser far from the lecturer location → confirm it's accepted
   (no geofence check should block it)
8. Test fraud flag: submit twice from same device with two different reg numbers
   in a STRICT session → confirm second submission is flagged, not rejected
```

---

Run these in order. Verify each phase builds and runs (`npm run dev`, click through the
flow) before moving to the next — don't chain all 8 phases into one Antigravity session.
