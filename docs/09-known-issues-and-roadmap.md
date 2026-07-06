# 09 — Known Issues & Roadmap

An honest account of what's unfinished, what's fragile, and what's been
deliberately deferred. Written so nobody has to rediscover these the hard
way.

---

## Placeholder / not fully wired up

- **Account deletion** (Settings, Danger zone) is currently a placeholder
  button — it does not yet call a real `deleteUser()` plus Firestore
  cleanup flow. Wire this up before relying on it for anything real.
- **`studentsMarked` on a session vs. the actual count of `attendanceRecords`
  documents** are two independently-maintained numbers. `studentsMarked` is
  a counter incremented/decremented directly on writes/deletes — it's fast
  to read (no query needed for the dashboard), but if it ever drifts out of
  sync with the real record count (e.g. a record gets deleted through some
  path that forgets to decrement it), nothing currently re-reconciles the
  two automatically. If dashboard counts ever look off, this mismatch is
  the first thing to check.
- **Average attendance rate** on Analytics shows a dash for any course with
  no roster uploaded, since the percentage calculation needs a roster size
  as the denominator. This is intentional (a percentage of an unknown total
  is meaningless) but is easy to mistake for a bug.

---

## Real incidents that happened during development, and what they teach

These are documented in detail so the same class of bug doesn't get
re-introduced by a future change.

### 1. Firestore query rejected outright even though the data was fine
A live-attendance listener queried only by `sessionId`, with no
`lecturerId` filter, and Firestore rejected the entire query because it
couldn't structurally prove every possible result satisfied the security
rule, even though in practice it always would have. Lesson: any query
against a rule-protected collection must explicitly filter on every field
that rule checks. Full writeup in `06-firestore-rules.md`.

### 2. Firestore rejects undefined field values outright
`addDoc()`/`updateDoc()` throw if any field in the payload is explicitly
`undefined` — not just ignores it, a hard crash. This bit both session
creation (when geofencing was off, an object still had a geofence field set
to undefined in it) and course share settings. Lesson: when a field is
conditional, omit the key entirely with a conditional spread, never assign
it undefined.

### 3. Server-side date parsing was silently off by one hour
Session `endTime` is a naive string with no timezone, built from a
lecturer's local time input (always Nigeria/WAT). Parsing that same string
on a Vercel server (which runs in UTC) with a plain `new Date(...)` silently
interpreted it as UTC instead — a real, hard-to-notice one-hour drift.
Fixed with `parseNaijaDateTime()` in `src/lib/utils.ts`. See
`04-data-model.md`'s timezone section.

### 4. A Next.js 16 framework bug, not an app bug
`proxy.ts` (the new name for `middleware.ts` in Next 16) had a real,
upstream, unresolved Vercel bug causing spurious 500 errors on RSC prefetch
requests in production only (worked fine in local dev). No amount of
debugging the app's own code would have found this — it was purely a
framework/hosting interaction. Reverted to the deprecated `middleware.ts`
name as a working alternative. Tracked upstream at vercel/next.js#87071 —
revert back once fixed.

### 5. firebase-admin v14 quietly broke production
Upgrading `firebase-admin` past v13 pulls in `jwks-rsa` then `jose@6`, which
is an ESM-only package with no CommonJS build. Vercel's bundler tried to
`require()` it anyway and crashed with `ERR_REQUIRE_ESM` — but only in
production, not local dev. Lesson: pinned to `firebase-admin@^13.5.0`
deliberately, with an overrides entry in `package.json` locking `jose` to
v4. Don't bump `firebase-admin` past v13 without checking this dependency
chain first.

### 6. A cron job that looked reasonable, but wasn't
An earlier design used a 5-minute Vercel Cron job to auto-end expired
sessions. Vercel's Hobby (free) plan hard-rejects deployment for any cron
schedule more frequent than once per day — this isn't a soft throttle, the
whole deploy fails. Replaced entirely with lazy expiry checks triggered by
real requests (see `07-api-routes.md`), which turned out to be strictly
better anyway: no background job needed at all, and it reacts instantly
rather than waiting for the next scheduled tick.

---

## Deliberate non-goals (from the original project scope, still true today)

- No student accounts or login of any kind, by design.
- No native mobile app — mobile-first responsive web only.
- "Fingerprinting" means device fingerprinting (FingerprintJS), never
  biometric/actual fingerprint scanning.
- No offline-first architecture — the app requires an internet connection;
  acceptable given it's used on campus wifi/mobile data.

---

## Honest fraud-prevention limitations (worth knowing, not fixing blindly)

The layered defenses described in `01-overview.md` are real and meaningfully
raise the cost of cheating, but a sophisticated, determined student could
still defeat parts of them:

- **GPS spoofing** — mock-location apps (common knowledge among CS
  students specifically) can fake a device's reported GPS position,
  defeating the geofence check. The system doesn't currently attempt to
  detect this.
- **The static share-link's range check only verifies the device that
  opens the link** — if that's a course rep's phone used as a stand-in
  projector, everyone visually scanning the screen is trusted to actually
  be in the room with them, which in practice is a reasonable assumption
  but not a cryptographic guarantee.
- **Device fingerprinting is a soft signal, not a hard block, by
  design** — a student could use two different physical devices to
  proxy-attend for two different friends, and fingerprinting alone
  wouldn't catch that (geofencing, if enabled, still would, since both
  devices would need to be in the room).

## Ideas discussed but not yet built (roadmap)

From product brainstorming during development, roughly ranked by
effort-vs-impact:

1. **Multiple spot-checks per session** — instead of one scan at the
   start, occasionally require a fresh re-scan through the class period,
   raising the cost of a friend proxying for someone who then leaves.
2. **Statistical flagging dashboard** — surface students whose attendance
   timestamps repeatedly correlate suspiciously closely with a specific
   other student's, across many sessions, for the lecturer to review — the
   data for this already exists in `attendanceRecords`, nothing new needs
   capturing.
3. **Bluetooth/local-network proximity** — a stronger alternative to GPS
   for verifying physical presence indoors (where GPS is often unreliable
   anyway), but needs a native app wrapper (e.g. Capacitor) since browsers
   restrict this kind of access — a bigger lift than anything above.
4. **Selfie-at-checkin audit trail** — capture a camera frame at
   submission time for the lecturer to spot-check manually (no automated
   face recognition) — a strong deterrent, but raises real
   privacy/consent questions worth thinking through carefully before
   building, since it's photographing students.
