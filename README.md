# RollMark

Intelligent QR-based attendance for Nigerian university lecturers and students.
Built from `RollMark_DESIGN.md` (UX/visual spec) + `RollMark_CONTEXT.md`/`RollMark_PROMPT.md`
(architecture spec, included in this repo for reference) —
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · React 19 · Firebase.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `proxy.ts`) |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) |
| Auth | Firebase Auth (Email/Password + Google) + httpOnly session cookie |
| Database | Firestore (client SDK for the lecturer, Admin SDK for server routes) |
| Validation | `firebase-admin` in API routes — never trusts the client |
| Animation | Framer Motion |
| Charts | Recharts |
| QR codes | `qrcode.react` |
| Device fingerprint | `@fingerprintjs/fingerprintjs` (open-source) |
| CSV | PapaParse |
| PDF export | jsPDF + jspdf-autotable |
| Email | Nodemailer + Gmail SMTP |
| Avatar upload | Cloudinary (unsigned preset, direct `fetch()`) |
| Icons | lucide-react |
| Toasts | react-hot-toast |

## 1. Why this architecture

Early versions of this app validated attendance (QR token, geofence distance, duplicate
check) entirely in the student's browser before writing straight to Firestore. That's
fine for UX feedback but is not real fraud prevention — anyone with devtools open can
spoof their reported location or replay a stale QR token, because nothing on the server
ever re-checks what the browser claims.

This build fixes that: **students never write to Firestore directly.** Every attendance
submission goes through `POST /api/attend/[sessionId]`, which uses `firebase-admin` to
independently re-verify the QR token, the geofence distance (using the server's own
stored coordinates, not whatever the client sends), the roster, and the duplicate check —
matching `CONTEXT.md §3`. The client-side distance readout the student sees while filling
the form is UX feedback only; the server is what actually decides.

## 2. Firebase setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
3. **Firestore Database** → Create database (production mode).
4. Project settings → General → add a Web App → copy the config into `.env.local`.
5. Project settings → **Service accounts** → Generate new private key → copy
   `client_email` and `private_key` into `.env.local` as `FIREBASE_ADMIN_CLIENT_EMAIL`
   and `FIREBASE_ADMIN_PRIVATE_KEY`. This is what powers the server-side validation route,
   the session-cookie auth gate, and the Server Actions — **the app cannot start without
   these three Admin vars set.**

```bash
cp .env.local.example .env.local
# fill in every value — see the comments in the file for where each one comes from
```

### ⚠️ Firestore rules require a manual publish — every time

`firestore.rules` is not wired to auto-deploy (Firebase Console publishing can't be
automated). After every rules change:

1. Firebase Console → Firestore Database → **Rules**
2. Paste the contents of `firestore.rules`
3. Click **Publish**

Read the comments at the top of that file — the rules intentionally lock students out of
Firestore entirely; all their reads/writes go through the Admin-SDK-backed API route,
which bypasses these rules by design.

## 3. Auth architecture (Phase 1)

- Firebase client SDK handles sign-in in the browser (email/password + Google).
- On every auth state change, the client calls `POST /api/auth/session` with a fresh ID
  token, which verifies it via `firebase-admin` and sets an httpOnly `rollmark_session`
  cookie (14-day expiry, cleared via `DELETE` on sign-out).
- **`src/proxy.ts`** (Next.js 16 renamed `middleware.ts` → `proxy.ts` — see
  [nextjs.org/docs/messages/middleware-to-proxy](https://nextjs.org/docs/messages/middleware-to-proxy))
  runs on every `/dashboard/*` and `/auth/*` request and, since `proxy` runs on the
  Node.js runtime (unlike the old Edge-only `middleware`), it fully verifies the session
  cookie with `adminAuth().verifySessionCookie()` before the page even renders — not just
  a presence check.
- `dashboard/layout.tsx` re-verifies the same cookie server-side as defense in depth.
- **Server Actions that mutate a session** (`src/lib/actions/session-actions.ts` — rotate
  QR, update geofence, end session) use the Admin SDK, which bypasses Firestore rules
  entirely. Each one manually re-reads the session cookie and checks
  `session.lecturerId === decoded.uid` before allowing the mutation — skipping this check
  would let any signed-in lecturer edit anyone else's session.

## 4. Data model

```
lecturers/{uid}
courses/{courseId}                        — lecturerId, code, name, rosterCount
courses/{courseId}/roster/{regNumber}     — batched-write subcollection (doc ID = reg number)
sessions/{sessionId}                      — lecturerId, courseId, mode, fields, qrToken, geofence, status
attendanceRecords/{sessionId}_{regNumber} — deterministic ID = atomic duplicate prevention
```

`attendanceRecords` uses `create()` with a deterministic doc ID (`{sessionId}_{regNumber}`)
instead of a query-then-write — Firestore's `create()` throws `ALREADY_EXISTS` atomically
if the doc exists, which closes a race condition a separate duplicate-check query would
leave open under simultaneous submissions.

Roster lives in a subcollection (not an array field) so validating one reg number during
submission is a single `get()` by ID rather than scanning an array, and so uploads over
Firestore's 500-writes-per-batch cap are chunked automatically (`lib/firestore.ts`,
`uploadRoster`).

## 5. Anti-fraud mechanisms (all server-verified)

| Mechanism | Where | Notes |
|---|---|---|
| Rotating QR (15s) | `lib/qrToken.ts`, `lib/actions/session-actions.ts` | Screenshot in a WhatsApp group dies within 15s |
| Geofence (STRICT mode) | `api/attend/[sessionId]/route.ts` | Haversine distance vs. the server's stored center — client never has authority here |
| Roster validation | Same route | Rejects unrecognized reg numbers, only enforced once a roster is uploaded |
| Duplicate reg number | Same route | Atomic via deterministic doc ID `create()` |
| Device fingerprint | `lib/fingerprint.ts` (`@fingerprintjs/fingerprintjs`) | Soft signal — **flags, doesn't block** — a repeat device triggers a lecturer email alert |

## 6. Email notifications (Phase 8)

`lib/server/email.ts` wraps Nodemailer + Gmail SMTP. Three triggers:

- **Session ended** — `endSessionAction` in `session-actions.ts`
- **Duplicate device flagged** — `POST /api/attend/[sessionId]` when a fingerprint repeats
- **Weekly summary** — `GET /api/cron/weekly-summary`, scheduled via `vercel.json`
  (`0 6 * * 1` — Monday 6am, once a week, which fits Vercel Hobby plan's cron limits)

All three no-op silently (with a console warning) if `GMAIL_SMTP_USER`/
`GMAIL_SMTP_APP_PASSWORD` aren't set, so missing email config never breaks attendance
marking itself. Use a 16-digit Gmail **App Password**, not your normal password —
[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (needs
2-Step Verification enabled).

## 7. Project structure

```
src/
  proxy.ts                            # Auth gate (Next.js 16's middleware replacement)
  app/
    api/
      auth/session/route.ts           # Sets/clears the httpOnly session cookie
      attend/[sessionId]/route.ts     # THE security-critical route — full server validation
      cron/weekly-summary/route.ts    # Vercel Cron target
    page.tsx                          # Landing
    auth/lecturer-login|signup/
    dashboard/                        # Server-verified layout wraps AppShell
      sessions/create/                # SessionCreationForm
      sessions/[sessionId]/           # LiveSessionBoard
      sessions/[sessionId]/history/   # CSV + PDF export, flag/unflag
      courses/                        # CourseList — roster upload/view
      records/  analytics/  settings/
    attend/[sessionId]/               # Public form — talks to the API route only
  components/{ui,molecules,organisms,shells}/
  lib/
    firebase.ts          # Client SDK (browser)
    firebase-admin.ts     # Admin SDK (server only, "server-only" guarded)
    auth-context.tsx      # useAuth() + session-cookie sync
    actions/session-actions.ts  # Server Actions with manual ownership checks
    server/email.ts       # Nodemailer, server-only
    firestore.ts          # Client SDK reads/writes for the authenticated lecturer
    fingerprint.ts         # FingerprintJS wrapper
    pdfExport.ts           # jsPDF report generation
    cloudinary.ts          # Avatar upload
```

## 8. Known gaps / deliberate divergences from CONTEXT.md

- **Submissions storage:** CONTEXT.md's schema stores submissions as an array field on
  the session doc (`arrayUnion`). This build uses a separate `attendanceRecords`
  collection instead — it scales better for the Records/Analytics pages that query across
  many sessions, and the deterministic-ID `create()` trick gives cleaner duplicate
  prevention than an array-membership check would. Functionally equivalent security
  properties either way.
- **Field naming:** internal field names (`mode` vs `authMode`, `status` vs `active`)
  don't match CONTEXT.md's schema verbatim — cosmetic only, not worth a mass rename given
  everything downstream is already consistent with itself.
- **Field types:** CONTEXT.md's `fields[]` schema includes `type` (`text`/`number`/`select`)
  and `order`. This build only has `label` + `required`/`optional`/`off` — all fields
  render as text inputs. Add `type` if you need numeric keyboards or dropdown fields on
  mobile.
- **At-risk student threshold** is hardcoded at 75%, not configurable per DESIGN.md's
  implied flexibility.
- **Account deletion** in Settings is a placeholder — wire it to a real
  `deleteUser()` + Firestore cleanup flow before relying on it.

## 9. Deploying to Vercel

1. Push to GitHub, import into Vercel.
2. Add **every** var from `.env.local` to Vercel's Environment Variables — the app will
   fail to build/run without the `FIREBASE_ADMIN_*` ones specifically, since
   `lib/firebase-admin.ts` throws if they're missing.
3. Add your Vercel domain to Firebase Console → Authentication → Settings → Authorized
   domains (needed for Google sign-in).
4. Deploy. The `crons` block in `vercel.json` (just the weekly summary email)
   activates automatically on Vercel.
5. Manually publish `firestore.rules` in the Firebase Console (see §2) — separate from
   the Vercel deploy, easy to forget.
