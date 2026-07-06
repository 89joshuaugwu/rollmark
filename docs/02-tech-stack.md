# 02 — Tech Stack

Every technology used in RollMark, what it's for, and — where relevant — why
it was chosen over alternatives.

## The big picture, in one sentence each

- **Next.js** builds and serves every page (both the lecturer dashboard and
  the public pages students see).
- **Firebase** is the database and the login system.
- **Vercel** hosts the whole thing and runs it in production.
- **TypeScript** means every piece of data has a known shape, catching a
  large class of bugs before the code ever runs.
- **Tailwind CSS** styles everything without writing custom CSS files.

## Full dependency table

| Package | Version | What it does in this project |
|---|---|---|
| `next` | 16.2.10 | The framework — routing, server rendering, API routes, the build system |
| `react` / `react-dom` | 19.2.4 | The UI library Next.js is built on |
| `typescript` | ^5 | Type-checking for the whole codebase |
| `firebase` | ^12.15.0 | Client-side Firebase SDK — login, and the lecturer's own reads/writes to the database |
| `firebase-admin` | ^13.5.0 | Server-only Firebase SDK — used for anything that needs to bypass normal database security rules (see `06-firestore-rules.md`) |
| `tailwindcss` / `@tailwindcss/postcss` | ^4 | All styling — no separate `.css` files per component |
| `framer-motion` | ^12.42.2 | Animations (success checkmarks, page transitions, error shakes) |
| `lucide-react` | ^1.23.0 | Every icon in the app |
| `qrcode.react` | ^4.2.0 | Renders the actual scannable QR code image from a URL string |
| `@fingerprintjs/fingerprintjs` | ^5.2.0 | Generates a semi-unique ID for a browser/device without asking permission — the "device fingerprinting" anti-fraud layer |
| `recharts` | ^3.9.1 | The attendance trend chart on the Analytics page |
| `papaparse` | ^5.5.4 | Reads/writes CSV files (roster upload, records export) |
| `jspdf` / `jspdf-autotable` | ^4.2.1 / ^5.0.8 | Generates PDF reports (session records, analytics report) |
| `nodemailer` | ^9.0.3 | Sends emails (session-ended notice, fraud alert, weekly summary) via Gmail SMTP |
| `react-hot-toast` | ^2.6.0 | The small pop-up notifications ("Session created", "Couldn't add student", etc.) |
| `server-only` | ^0.0.1 | A safety guard — makes the build fail loudly if server-only code (like database admin credentials) accidentally gets imported into client-facing code |

## Hosting & infrastructure

| Service | Role |
|---|---|
| **Vercel** | Hosts the deployed app, runs the build on every `git push`, runs the one scheduled background job (weekly summary email) |
| **Firebase Authentication** | Handles lecturer login — email/password and "Continue with Google" |
| **Firestore** | The database — every course, session, and attendance record lives here |
| **Gmail SMTP** | Sends all outgoing email, using a 16-digit Gmail "app password," not the actual Gmail account password |

## Why Firestore instead of a traditional SQL database?

Firestore is a **document database** (think: folders full of JSON files,
roughly) rather than a table-based one. It was chosen because:

- It has built-in **real-time listeners** — the lecturer's live session
  board updates the moment a student submits attendance, with no polling or
  manual refresh needed. This is the actual mechanism behind "Attendance
  marked (4)" updating live on screen.
- It integrates directly with **Firebase Authentication**, so login and
  database access rules share the same identity system.
- **Security rules** (see `06-firestore-rules.md`) let you describe "who can
  read/write what" directly against the database, without needing a custom
  backend server for every single check.

The trade-off: Firestore's security rules have real, sharp-edged quirks —
most notably that certain queries can be rejected outright if they don't
structurally prove they satisfy a rule, even if the actual data would have
been fine. This has caused real bugs in this project (see
`06-firestore-rules.md` for the specific incident and fix).

## Why two different Firebase SDKs (`firebase` and `firebase-admin`)?

This is one of the most important things to understand about this codebase
— covered in full in `03-architecture.md`, but the one-line version:

- `firebase` (client SDK) — runs in the lecturer's browser, respects
  Firestore security rules, used for everything the *lecturer* does.
- `firebase-admin` (admin SDK) — runs only on the server, **completely
  bypasses** Firestore security rules, used for everything a *student*
  (who has no account at all) needs to do, like submitting attendance.

## Design system

Colors and fonts are defined once as CSS variables (see
`src/app/globals.css`) and referenced everywhere through Tailwind:

| Role | Color | Hex |
|---|---|---|
| Primary / success / brand | Emerald | `#10B981` |
| Background | Almost-black navy | `#0F172A` |
| Card background | Slate | `#1E293B` |
| Warning | Amber | `#F59E0B` |
| Error / fraud flag | Rose | `#F43F5E` |
| Success accent | Lime | `#22C55E` |

The app is **dark mode only** — there is no light mode toggle. This was a
deliberate choice for battery savings on mobile, which is where the vast
majority of usage happens (students scanning QR codes on their phones).
