# RollMark — Project Documentation

Welcome. This folder explains **everything about how RollMark works** — for
someone who has never seen the codebase, all the way through to a developer
who needs to pick up where the previous person left off.

If you're new here, **read these in order**:

| # | File | What it covers | Who it's for |
|---|---|---|---|
| 1 | [`01-overview.md`](./01-overview.md) | What RollMark is, who uses it, why it exists | Everyone — start here |
| 2 | [`02-tech-stack.md`](./02-tech-stack.md) | Every technology used and why | Non-technical + developers |
| 3 | [`03-architecture.md`](./03-architecture.md) | How the pieces fit together, with diagrams | Developers |
| 4 | [`04-data-model.md`](./04-data-model.md) | Every database collection, field by field | Developers |
| 5 | [`05-auth-flow.md`](./05-auth-flow.md) | How login/signup/logout actually works | Developers |
| 6 | [`06-firestore-rules.md`](./06-firestore-rules.md) | Database security rules explained | Developers |
| 7 | [`07-api-routes.md`](./07-api-routes.md) | Every server API endpoint | Developers |
| 8 | [`08-pages-audit.md`](./08-pages-audit.md) | Every page in the app, what it does | Everyone |
| 9 | [`09-known-issues-and-roadmap.md`](./09-known-issues-and-roadmap.md) | What's unfinished, what to build next | Everyone |

---

## The one-paragraph version

**RollMark is a QR-code-based attendance tracking web app**, built for
lecturers at Nigerian universities. A lecturer creates an "attendance
session" for a class, a QR code appears on their screen, students scan it
with their own phones, fill in a short form, and their attendance is recorded
instantly. The QR code changes every 60 seconds and the system silently
fingerprints each student's device — both exist purely to make it hard for
one student to mark attendance for absent friends. Optionally, the lecturer
can require students to be physically near the classroom (GPS-checked) to
mark attendance at all. Everything is built with Next.js, hosted on Vercel,
and stores its data in Google Firebase (Firestore).

## If you only read one other file

Read **`03-architecture.md`** — it explains the single most important design
decision in this whole project: **the app has two completely separate "who
can touch the database" pathways** (one for lecturers, one for students),
and almost every bug this project has ever hit traced back to someone
forgetting that these two pathways exist and work differently.

## How to hand this project to someone else

1. Give them this `docs/` folder first — not the code.
2. Point them at `01-overview.md` → `03-architecture.md` in that order.
3. Once they understand the two-pathway concept above, the rest of the code
   reads naturally — components are named after what they do, and the
   folder structure mirrors the page structure almost exactly.
4. Give them access to: the GitHub repo, the Vercel project, the Firebase
   Console project, and this specific detail — **Firestore security rules
   require a manual copy-paste-publish in the Firebase Console every time
   they change.** This is not automated by deploying the code, ever. It has
   caused real production outages in this project before. See
   `06-firestore-rules.md`.
