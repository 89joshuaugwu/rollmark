# 01 — Overview

## What is RollMark?

RollMark is a web application that replaces the old way lecturers take
attendance in Nigerian university lecture halls — calling out registration
numbers one by one, or passing round a sign-in sheet that anyone can sign on
behalf of an absent friend.

Instead:

1. The lecturer opens RollMark on their laptop or phone and starts an
   "attendance session" for a specific course.
2. A QR code appears on their screen.
3. Students scan it with their own phones' cameras.
4. Scanning opens a short form (name, reg number, etc.) in the student's
   browser — no app to install, no account to create.
5. The student fills it in and submits. Attendance is recorded instantly,
   and the lecturer sees it appear live on their screen.
6. At the end of the class, the lecturer ends the session and can export the
   attendance list as a CSV or PDF.

## Who uses it

- **Lecturers** — the only people who ever create an account. They sign up,
  log in, create courses, run sessions, and review records.
- **Students** — never create an account, never log in. They only ever
  interact with one page: the attendance form they land on after scanning a
  QR code.

This is a deliberate design choice, not an oversight — see
`03-architecture.md` for why.

## The core problem it solves: proxy attendance

The single biggest problem with any digital attendance system is the same
problem as the paper sign-in sheet: **one student can mark attendance for
students who aren't actually there.** RollMark layers several independent
defenses against this, each covering a different way someone might try to
cheat:

| Defense | What it stops | Always on? |
|---|---|---|
| **Rotating QR code** (changes every 60 seconds) | A student photographing the QR code and sharing it in a WhatsApp group so absent friends can scan it later | Yes, always |
| **Device fingerprinting** (silent, no prompt) | One student physically scanning multiple times for multiple friends using their own phone | Yes, always |
| **Geofencing** (optional, lecturer turns it on) | Anyone marking attendance from outside the actual classroom/building | Only if the lecturer enables it for that session |
| **Static share-link range gate** (optional, per course) | A class-representative's phone (used to display the QR when there's no projector) being used from outside the room | Only if the lecturer enables it for that course |
| **Auto-expiring sessions** | Attendance being marked after the class has actually ended | Yes, always |

None of these are perfect on their own (see `09-known-issues-and-roadmap.md`
for a full honest discussion of what a determined cheater could still do) —
they're deliberately layered so that defeating all of them at once is
significantly harder than defeating any single one.

## What makes this specifically built for Nigeria

- **Geofencing has a low-accuracy fallback.** GPS often fails indoors or on
  laptops without a GPS chip — common in Nigerian lecture halls and among
  students on older Android devices. The location system tries a precise GPS
  fix first, then falls back to WiFi/cell-tower-based positioning rather
  than just failing outright.
- **The "static share link" feature** exists specifically because many
  Nigerian lecture halls don't have a projector. Instead of a lecturer
  physically handing their phone to 100+ students to scan one by one, they
  can post a link in the class WhatsApp/Telegram group. Whoever opens it
  (e.g. the course representative) must be physically near the classroom for
  the link to work at all, and it always shows whichever session is
  currently live for that course — so it's posted once and works forever.
- **All times are treated as Nigeria time (WAT, UTC+1, no daylight saving)**
  explicitly in the code, because the app's servers run in a different time
  zone (UTC) by default and would otherwise silently be an hour off.

## What RollMark is *not*

- It is **not** a learning management system — no assignments, no grades,
  no course content.
- It is **not** a native mobile app — it's a responsive website that works
  in any phone's browser.
- Students **never** have accounts, passwords, or logins of any kind.
