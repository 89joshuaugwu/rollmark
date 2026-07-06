# 08 — Page-by-Page Audit

Every route in the app, what it does, who can see it, and which components
build it. Routes are grouped the same way the URL structure groups them.

---

## Public pages (no login required)

### `/` — Landing page
**File:** `src/app/page.tsx`
The marketing homepage. "Attendance. Reimagined." headline, feature cards
(Geofence + QR, Mobile-first, Real-time analytics), "Get started" /
"I already have an account" buttons. Wrapped in `PublicShell`.

### `/auth/lecturer-signup` and `/auth/lecturer-login`
**Files:** `src/app/auth/lecturer-signup/page.tsx`, `lecturer-login/page.tsx`
Email/password + "Continue with Google" forms. See `05-auth-flow.md` for
exactly what happens on submit. If a lecturer is already logged in and
visits either of these, `middleware.ts` redirects them straight to
`/dashboard` instead of showing the form.

### `/attend/[sessionId]` — The attendance form
**File:** `src/app/attend/[sessionId]/page.tsx`, renders `AttendanceForm.tsx`
The page every student actually lands on after scanning a QR code. Reads
`?t=` (the QR token) from the URL. Handles every state: loading, invalid
session, expired token, ended session, the actual form, and the success
screen (checkmark + confetti). See `07-api-routes.md` for the two API calls
this page makes.

### `/s/[slug]` — The static share-link page
**File:** `src/app/s/[slug]/page.tsx`, renders `ShareBoard.tsx`
The reusable, per-course link a lecturer can post once in a class group
forever. Shows a live, auto-rotating QR code for whichever session on that
course is currently active, gated by an optional GPS range check. Polls
`/api/share/[slug]` roughly every 30 seconds. See `03-architecture.md` for
how this differs from `/attend/[sessionId]`.

---

## Dashboard pages (login required, every route below sits behind `middleware.ts` and `dashboard/layout.tsx`)

All of these are wrapped in `AppShell` (sidebar on desktop, bottom tab bar
on mobile).

### `/dashboard` — Main hub
**File:** `src/app/dashboard/page.tsx`
The first thing a lecturer sees after logging in. Shows quick stats
(sessions this month, students marked this week, avg. attendance/session),
any currently-active session, and a short recent-activity feed. Also
where the lazy session-expiry self-heal runs (see `04-data-model.md`) — any
session past its `endTime` that the database hasn't caught up on yet gets
silently corrected the moment this page loads it.

### `/dashboard/sessions/create` — Create attendance session
**File:** `src/app/dashboard/sessions/create/page.tsx`, renders `SessionCreationForm.tsx`
Where a lecturer sets up a new session: pick/add a course, date and
start/end time, which fields to capture (with a toggle-based
required/optional/off picker per field, plus custom fields), and the single
"Require location to check in" toggle. If that toggle is on, a location
capture and radius slider section appears. On submit, creates the sessions
document and redirects straight into the live board below.

### `/dashboard/sessions/[sessionId]` — Live session board
**File:** `src/app/dashboard/sessions/[sessionId]/page.tsx`, renders `LiveSessionBoard.tsx`
The screen a lecturer keeps open during class. Shows the actual rotating QR
code, the live-updating list of who's marked attendance so far (real-time,
via a Firestore listener), manual add-student option, and the ability to
turn geofencing on or off for this specific session even after it's already
started (since `SessionCreationForm` has no edit mode after creation).
Also where a session auto-ends the instant its scheduled end time passes,
for whoever has this exact page open.

### `/dashboard/sessions/[sessionId]/history` — Session history
**File:** `src/app/dashboard/sessions/[sessionId]/history/page.tsx`
The read-only record of one specific ended (or still-active) session: full
attendance list, flag/unflag actions, CSV and PDF export buttons.

### `/dashboard/courses` — Manage courses
**File:** `src/app/dashboard/courses/page.tsx`, renders `CourseList.tsx`
Add/delete courses, upload a roster CSV per course (regNumber, firstName,
lastName, email format), and configure each course's static share link
(`ShareLinkSettings.tsx`) — toggle range-gating on/off, capture the
classroom's saved location, and copy the shareable `/s/[slug]` link.

### `/dashboard/records` — Search all attendance records
**File:** `src/app/dashboard/records/page.tsx`
Search by reg number or name, filter by course, across every session a
lecturer has ever run. "Export all" button for a full CSV.

### `/dashboard/analytics` — Trends and at-risk students
**File:** `src/app/dashboard/analytics/page.tsx`, renders `AnalyticsDashboard.tsx`
Attendance trend line chart (Recharts), a card listing students below a
configurable attendance-rate threshold, and a PDF export of the whole
report.

### `/dashboard/settings` — Profile and preferences
**File:** `src/app/dashboard/settings/page.tsx`
Name, email, department, avatar upload (Cloudinary), the three
notification toggles (session-ended email, duplicate-device alert, weekly
summary), a send-password-reset-email action, and the danger-zone account
deletion placeholder (see `09-known-issues-and-roadmap.md`, this one isn't
fully wired up yet).

---

## Layout files (not pages themselves, but worth knowing about)

| File | Role |
|---|---|
| `src/app/layout.tsx` | The root layout — fonts, global CSS, wraps everything in `AuthProvider` |
| `src/app/dashboard/layout.tsx` | The server-side login re-check that gates every `/dashboard/*` page (see `05-auth-flow.md`) |
| `src/middleware.ts` | Runs before any of the above, on every matching request |

## Where the actual UI building-blocks live

If you're trying to find "the thing that renders X on screen," the mapping
is almost always: **page.tsx (thin wrapper) leads to one organisms/
component (the actual logic and layout) leads to several molecules/ and ui/
components (the reusable pieces)**. For example: `/dashboard/sessions/[sessionId]/page.tsx`
is only a few lines long — nearly everything you see on that page lives in
`src/components/organisms/LiveSessionBoard.tsx`.
