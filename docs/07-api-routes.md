# 07 — API Routes

RollMark has a small number of server API routes. All of them run on
Vercel's servers (`runtime = "nodejs"`), never in the browser, and all of
them use `firebase-admin` for any database access — meaning **none of these
routes are subject to `firestore.rules`**. Whatever a route allows is
entirely down to the checks written in that route's own code.

---

## `GET /api/attend/[sessionId]`

**Called by:** the public `/attend/[sessionId]` page, right when a student's
browser loads it (after scanning a QR code).

**Purpose:** fetch a *sanitized* version of the session — just enough info
to render the attendance form (course name, which fields to show, whether
geofencing is required) without exposing the lecturer's ID or any other
internal data.

**Query param:** `?t=` — the QR token from the scanned URL.

**What it checks, in order:**
1. Does the session exist at all? If not, `status: "invalid"`
2. Has this session's `endTime` already passed? If so, it's lazily marked
   ended right here (see the note on lazy expiry below), returns `status: "ended"`
3. Does the QR token in the URL match the session's current `qrToken`? If
   not (it rotated since the QR was scanned), returns `status: "expired"`
4. Otherwise returns `status: "ok"` with the sanitized session fields

---

## `POST /api/attend/[sessionId]`

**Called by:** the same page, when the student taps "Submit attendance."

**This is the highest-stakes endpoint in the whole app** — every real
anti-fraud check happens here, server-side, because none of it can be
trusted from the browser alone.

**Body:** `{ qrToken, regNumber, firstName, surname, middleName?, phone?,
email?, location?, fingerprint }`

**Checks, in order, any of which can reject the submission:**

| # | Check | Rejection message |
|---|---|---|
| 1 | Session exists | "Session not found." |
| 2 | Session hasn't already expired (lazy check, see below) | "This session has ended." |
| 3 | QR token matches the session's current one | "This QR code has expired. Ask your lecturer to refresh and scan again." |
| 4 | If `requireGeofence` is on: location was provided and is within the saved radius | "You are {X}m away. Move closer." |
| 5 | Registration number hasn't already submitted for this session | "Your registration number already marked present." |

**What does NOT reject the submission, but flags it instead:** if the
device fingerprint sent has already been used for a *different*
registration number in this same session, the submission still succeeds,
but the record is saved with `flagged: true` — this shows up as "possible
duplicate device" on the lecturer's live board. This is intentional — see
`01-overview.md` for why it's a soft signal, not a hard block.

**On success:** creates a new `attendanceRecords` document and increments
the session's `studentsMarked` counter.

**A note on the "lazy expiry" pattern used here (and in the two routes
below):** rather than a scheduled background job sweeping for expired
sessions, expiry is checked *on the actual request that's already
happening*. The first real access to an expired session — a student trying
to submit, or a lecturer's dashboard listing it — is what flips its
`status` to ended in the database. See `09-known-issues-and-roadmap.md`
for the full reasoning behind this choice over a cron job.

---

## `GET /api/share/[slug]`

**Called by:** the public `/s/[slug]` page (the "static share link"
feature), polled roughly every 30 seconds while that page is open.

**Query params:** `?lat=` `?lng=` — the opener's current GPS coordinates, if
available.

**What it does:**
1. Looks up the course by its `shareSlug`. Doesn't exist, returns `status: "invalid"`
2. If that course has `shareGeofenceEnabled`, checks the given lat/lng
   against the saved `shareGeofence`. No location provided yet returns
   `status: "location_required"`. Too far away returns `status: "out_of_range"`
   (this message is deliberately generic — it never reveals whether the
   course/slug exists to someone probing it from far away)
3. Looks for whichever session on that course currently has
   `status: "active"`, returns `status: "no_session"` if none
4. Otherwise returns `status: "ok"` with just enough info to render the
   live rotating QR code

---

## `POST /api/auth/session`

**Called by:** `src/lib/auth-context.tsx`, right after a lecturer logs in or
signs up (any method).

**Body:** `{ idToken }` — a fresh Firebase Auth ID token from the browser.

**What it does:** verifies the token is genuine, then creates a 14-day
httpOnly session cookie (`rollmark_session`) and sets it on the response.
This cookie is what `middleware.ts` and `dashboard/layout.tsx` check on
every subsequent request — see `05-auth-flow.md`.

## `DELETE /api/auth/session`

**Called by:** logging out. Clears the `rollmark_session` cookie
immediately.

---

## `GET /api/cron/weekly-summary`

**Called by:** Vercel Cron only, on the schedule set in `vercel.json`
(currently `0 6 * * 1` — every Monday at 6am).

**Auth:** checks the request's `Authorization` header equals
`Bearer ${CRON_SECRET}` — Vercel automatically sends this header on
cron-triggered requests when the `CRON_SECRET` environment variable is set,
so this isn't something you need to configure per-request, just set the
one env var once.

**What it does:** for every lecturer who has `notifications.weeklySummary`
enabled, tallies up their sessions and students-marked from the last 7
days, and — only if they actually ran at least one session that week —
sends them a summary email. Lecturers with no activity that week are
silently skipped, not emailed an empty report.

---

## A route that used to exist and was deliberately removed

An earlier version of this project had a
`GET /api/cron/end-expired-sessions` route, meant to run every 5 minutes and
auto-end any session past its `endTime`. It was removed because:

1. Vercel's Hobby (free) plan hard-rejects any cron schedule more frequent
   than once per day — the deployment itself fails outright, it doesn't
   silently throttle.
2. It turned out to be unnecessary — the lazy-expiry checks already built
   into `/api/attend/[sessionId]` and the dashboard's session list
   (`listSessions()` in `src/lib/firestore.ts`) already catch every case
   that actually matters, since every session access is already a real
   HTTP request. See `09-known-issues-and-roadmap.md` for the full story.

If you ever see a reference to this route, or a comment about a 5-minute
cron schedule, in old documentation, notes, or chat history — it's stale.
Ignore it.
