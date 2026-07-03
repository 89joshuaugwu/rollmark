# RollMark — DESIGN.md

**Product:** Intelligent QR-based attendance system for Nigerian university lecturers and students.  
**Target:** Mobile-first (95% mobile users) + desktop admin.  
**Status:** Production-ready spec for Next.js 16 + Tailwind CSS v4 + React 19.

---

## 1. Brand Identity

### Name & Positioning
**RollMark** — Roll call + marking presence, fast and frictionless. Implies both *speed* ("roll" as in quick) and *precision* ("mark" as in record).

### Color Palette
| Role | Color | Hex | Use |
|---|---|---|---|
| Primary | Emerald Green | `#10B981` | QR success, active states, CTAs |
| Secondary | Slate Dark | `#1F2937` | Backgrounds, text, cards |
| Accent | Amber | `#F59E0B` | Warnings, geofence alerts, "move closer" states |
| Success | Lime | `#22C55E` | Submit success, attendance confirmed |
| Error | Rose | `#F43F5E` | Rejection, "already marked", fraud flags |
| Neutral BG | Almost Black | `#0F172A` | Main background (mobile-first dark) |
| Card BG | Slate 800 | `#1E293B` | Layered cards, elevated surfaces |
| Text Primary | White | `#FFFFFF` | Headlines, primary text |
| Text Secondary | Slate 400 | `#94A3B8` | Labels, hints, secondary copy |

### Typography
- **Headings:** Inter Bold 700 (sans-serif, geometric, Nigerian market appeal)
- **Body:** Inter Regular 400 (clean, readable on mobile)
- **Mono:** JetBrains Mono 500 (tech/QR/code displays)
- **Scale:** 16px base (mobile-first) → 18px+ on desktop

### Animations
- **Micro-interactions:** Framer Motion 11.x
  - Tap: `scaleDown 0.08s ease-out` (button press)
  - Success: Confetti + fade-in (`opacity 0→1, scale 0.8→1, 0.4s ease-out`)
  - Error shake: `translate-x [-4px, 4px, -4px, 0] 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)`
  - Page transition: Fade + slide-up (`opacity 0→1, translateY 20px→0, 0.3s ease-out`)
  - Loading spinner: Rotating SVG, Emerald Green stroke
- **Gesture:** Swipe between tabs (React Spring)
- **No animations on submission** to unblock waiting time

---

## 2. Page Map & Routing

```
/                                    # Public landing
  ├─ /auth/lecturer-signup           # Signup (email + password + Google)
  ├─ /auth/lecturer-login            # Login (email + password + Google)
  │
/dashboard                           # Authenticated lecturer root
  ├─ /dashboard                      # Main hub (active sessions, quick stats, feed)
  ├─ /dashboard/sessions/create      # Create new session (mode toggle, fields, geofence)
  ├─ /dashboard/sessions/[sessionId] # Live session view (QR on screen, ticker, controls)
  ├─ /dashboard/sessions/[sessionId]/history  # Past submissions + export
  ├─ /dashboard/courses              # Manage courses, upload rosters
  ├─ /dashboard/records              # Search attendance history, CSV/PDF export
  ├─ /dashboard/analytics            # Trends, at-risk students, reports
  ├─ /dashboard/settings             # Profile, branding, notifications
  │
/attend/[sessionId]                  # Public scan → fill → submit (no auth)
  └─ ?t=[qrToken]                    # URL param for QR token
  │
/admin (optional, for defense)       # Admin approval + cross-lecturer overview
  ├─ /admin/lecturers                # Approve signups
  ├─ /admin/system                   # Health, logs
```

---

## 3. Component Architecture

### Navigation & Shells

**AppShell** (Lecturer, authenticated)
- Top bar: Logo "RollMark", user menu (profile → settings → logout)
- Bottom nav (mobile): Dashboard | Sessions | Courses | Records | Settings
- Sidebar (desktop): Vertical nav with icons + labels
- Mobile: Full-height slide-out drawer on hamburger

**PublicShell** (Landing, auth, attend)
- Minimal top bar: Logo + theme toggle
- Center-aligned content
- No persistent nav

### Atoms
- **Button** — primary (Emerald), secondary (Slate), danger (Rose), loading state, icon + text variants
- **Input** — text, email, password, number, date, time, select, multi-select; focus: Emerald ring
- **Card** — Slate 800 bg, rounded-lg, shadow-sm, hover lift
- **Badge** — inline status (Active, Ended, Pending), color-coded
- **Spinner** — centered loading, Emerald stroke
- **Toast** — bottom-right stack, auto-dismiss 3s (success / error / info)
- **Modal** — centered, overlay, close button
- **Slider** — range input, Emerald track, labeled min/max

### Molecules
- **LocationPill** — displays `lat,lng ±Xm accuracy` with pin icon
- **QRDisplay** — large bordered QR code (12cm×12cm on desktop, full width on mobile), underneath: "Scan or refresh in 15s", countdown timer
- **SessionCard** — course name, date, students marked, status badge, tap to expand/manage
- **FieldToggle** — each field (Surname, Phone, Email, etc.) as a row: `[toggle icon] Label [required/optional picker]`
- **GeofenceRadius** — slider + visual gauge, min 30m / max 150m, current value highlighted
- **LiveTicker** — scrolling list of recent submissions (name, timestamp, status indicator)
- **StudentRow** — in history: reg number, name, phone, email (if captured), time, location accuracy (if STRICT)

### Organisms
- **SessionCreationForm**
  - Mode selector (STRICT / PERMISSIVE)
  - Course picker + date/time window
  - Field toggles (pre-built + custom add)
  - [If STRICT] Location + geofence range
  - Submit → confirmation toast

- **LiveSessionBoard**
  - Hero section: QR code (large), rotating countdown
  - Lecturer location display (if STRICT): "Your location: 6.5195°N, 3.3792°E ±12m"
  - Live ticker: scrolling attendance list, green checkmarks
  - Manual add/remove buttons (edit mode)
  - [End Session] button, confirmation modal

- **AttendanceForm** (/attend/[sessionId])
  - [If STRICT] "Allow location access?" prompt + live accuracy display
  - Form fields (dynamically rendered from session.fields config)
  - Textarea for optional fields
  - Submit button (disabled until all required fields filled)
  - Success state: Checkmark + "Attendance recorded ✓" + confetti animation

- **CourseList**
  - Add course modal
  - Upload roster CSV (drag-drop or file picker)
  - List of courses with edit/delete actions

- **AnalyticsDashboard**
  - Attendance trend line chart (Recharts)
  - At-risk student flag card ("5 students <75% attendance")
  - Export buttons (CSV, PDF)

---

## 4. Mobile-First Design Spec

### Viewport Breakpoints
- **Mobile:** 320–767px (primary design target)
- **Tablet:** 768–1024px
- **Desktop:** 1025px+

### Mobile Constraints
- **Tap targets:** Minimum 48×48px (iOS + Android standard)
- **Spacing:** 16px gutters, 12px internal padding
- **Typography:** 16px base (prevents mobile zoom on input focus)
- **Form inputs:** Full width, 44px height
- **Buttons:** Full width or 2-column on mobile (except CTA, which is always full)
- **Bottom sheet:** Content drawer on mobile, modal on desktop
- **Sticky footer:** [Submit] button floats over content, dark gradient backdrop

### Gestures (Mobile)
- **Tap:** Button, card navigation
- **Swipe left/right:** Tab navigation (Sessions, Courses, Records)
- **Pull-to-refresh:** Session live ticker + dashboard feed
- **Long-press:** Copy text (QR token, location, etc.)

### Dark Mode (Default)
- No light mode toggle needed for launch (Nigerian preference for battery savings)
- All backgrounds: Neutral BG or Card BG
- All text: Text Primary (white) or Text Secondary (slate)
- Inputs: Slate 700 bg, white text, Emerald ring on focus

---

## 5. Page-by-Page UX Flow

(See full document for the page-by-page wireframe-in-prose breakdown of Landing, Auth,
Dashboard, Create Session, Live Session, Attendance Form, Courses, Records, Analytics,
and Settings — condensed here since the build already implements each of these flows.)

---

## 6. Component Interaction Patterns

### Loading States
- Skeleton screens for list items (during fetch)
- Spinner overlay for full-page loads (form submissions)
- Progressive loading: fetch critical content first (QR), then ticker

### Error Handling
- **Field validation:** Red ring + error text below input (Tailwind `ring-red-500`)
- **Network error:** Toast + retry button
- **Geofence rejection:** Clear distance display + "Move closer" instruction
- **Fraud flag:** Toast + notification, but still allow submission (log for lecturer review)

### Success Feedback
- Toast notification (3s auto-dismiss)
- Card highlight animation (Framer Motion `scaleIn`)
- Confetti on major wins (attendance submitted successfully)

### Offline Support
- Cache recent sessions in localStorage
- Form draft auto-save
- Retry on reconnect

---

## 7. Accessibility

- **Color contrast:** All text meets WCAG AA (white on dark bg = 8.6:1)
- **Tap targets:** 48px minimum on mobile
- **Labels:** All inputs have visible or aria-label
- **Focus indicator:** Emerald ring visible on all interactive elements
- **Skip link:** Jump to main content (optional, for defender bonus points)
- **Alt text:** All images have descriptive alt text

---

## 8. Animation Specs (Framer Motion)

| Element | Trigger | Animation |
|---|---|---|
| Button tap | Click | `scale: 1 → 0.95 → 1` (0.1s) |
| Form submit success | API success | `opacity: 0→1, scale: 0.8→1` (0.4s ease-out) + confetti |
| Toast enter | Trigger | `slideIn from bottom` (0.2s) |
| Toast exit | Auto dismiss | `slideOut to bottom` (0.2s) |
| Geofence error shake | Validation fail | `rotate: [-2deg, 2deg, -2deg, 0]` (0.3s) |
| QR refresh pulse | Every 15s | `opacity pulse` (1s loop) |
| Modal overlay | Open | `opacity: 0→1` (0.2s), content `scale: 0.9→1` |
| Page transition | Route change | `fade + slideUp 20px` (0.3s ease-out) |

---

## 9. Dark Mode Implementation

- **CSS variables (Tailwind CSS v4 with `:root` scope):**
  ```css
  :root {
    --color-bg: #0F172A;
    --color-card: #1E293B;
    --color-primary: #10B981;
    --color-text: #FFFFFF;
    --color-text-secondary: #94A3B8;
  }
  ```
- **No light mode toggle** (default dark, saves battery on mobile)
- **System theme respect** (optional: detect `prefers-color-scheme`, but default dark)

---

## 10–16.

(QR display specs, responsive typography scale, form design, mobile navigation pattern,
data visualization, imagery/icons, and loading/empty states — all implemented as
specified in the build. See `src/app/globals.css` and the component files under
`src/components/` for the concrete implementation of each.)
