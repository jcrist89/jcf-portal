# Jon Crist Fit (JCF) — App Overview

A reference doc describing what's actually built, for gameplanning future enhancements
(e.g. with Claude Cowork). Reflects the app's real state, not the original build spec —
several things have evolved past that spec (auth model, billing, training maxes).

## 1. What this is

JCF is a web-based training platform for Jon Crist (a strength/personal coach) and his
clients. It's a Progressive Web App (installable to a phone home screen, works full-screen
like a native app) built for a small roster (under ~50 clients) — simplicity and low cost
over enterprise scale. Two experiences: a **client dashboard** (log workouts, track
progress, earn badges) and a **coach dashboard** (see every client's activity live, manage
programs and accounts).

## 2. Tech stack

- **Frontend:** Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres + Supabase Auth + Realtime), accessed via `@supabase/ssr`
- **Payments:** Stripe (live mode), subscriptions with webhook-driven tier sync
- **Push notifications:** Web Push (VAPID) via the `web-push` library
- **Charts:** Recharts
- **Hosting:** Vercel (frontend + cron), Supabase cloud (backend)
- **PWA:** hand-rolled manifest (`public/manifest.json`) + service worker (`public/sw.js`)

## 3. Auth & roles

- Real Supabase Auth (email + password) — this **replaced** an earlier custom PIN-based
  scheme used in v1. Two roles: `coach` and `client`, stored on `profiles.role`.
- **Public signup** exists (`/signup`) — anyone can create a free-tier account directly,
  no coach action required. Coaches can *also* create client accounts manually from the
  coach dashboard (sends an email invite to set a password).
- Password reset / forgot-password flows exist (`/forgot-password`, `/reset-password`),
  including recovery via emailed links.
- Row Level Security is enabled on every table: clients can only read/write their own
  rows; a Postgres function `is_coach(uid)` grants the coach role full read/write access
  to everything. Enforced at the database level, not just in the app.
- Session persists via Supabase's own cookie-based session handling, refreshed on every
  request through Next.js middleware (`src/middleware.ts`).

## 4. Data model (Postgres tables)

| Table | Purpose |
|---|---|
| `profiles` | One row per user (coach or client): name, birthday, height, weight, goal, assigned program, **tier**, Stripe customer/subscription IDs + status, active/onboarded flags, `last_nudge_threshold` (inactivity-nudge tracking) |
| `programs` | Program templates (4 starter goals) *and* per-client copies. `is_template` distinguishes a shared template from a client's own instance. `structure` is JSON: weeks → days → exercises (name/sets/reps/rest/notes, optionally tied to a training max via `liftKey`/`percentOfTm`). Has an optional `meet_date` for powerlifting meet countdowns. |
| `measurements` | Time-series check-ins: weight, waist, chest, hips, arms, thighs, notes |
| `prs` | Personal records: lift, weight, reps, date, notes (auto-detected from workout logs, or manually logged) |
| `workout_logs` | One row per logged workout: day label, `exercises_completed` (JSON: sets with reps/weight/RPE), completed flag |
| `training_maxes` | Per-client, per-lift training max (used for %-based programming, e.g. powerlifting) |
| `achievements` | Earned badges: type, title, description, date, icon |
| `coach_notes` | Two-way message thread per client (author: coach or client, read flag) |
| `push_subscriptions` | Web Push subscription endpoints per profile (added for push notifications) |

Four starter program templates seeded: **Strength Gain**, **Fat Loss**, **Hybrid**,
**Powerlifting** — editable by the coach without touching code.

## 5. Client-facing features

Bottom nav (mobile, horizontally scrollable): **Home · Program · Progress · Badges ·
Messages · Billing · Settings**.

- **Onboarding** (`/onboarding`): name, birthday, height, starting weight, initial
  measurements, goal selection. Selecting a goal auto-assigns the matching program
  template (copied into a client-specific instance).
- **Dashboard / Home** (`/dashboard`): welcome header, stat row (streak in weeks, last
  logged weight, total workouts), "Up Next" card showing the next workout day, recent
  activity list. **New:** an inactivity nudge banner appears here when a client has gone
  quiet (3+/7+/14+ days since last log), scaled by severity.
- **My Program** (`/program`): full program view, day-by-day logging (sets/reps/weight/RPE
  per exercise), shows last performance for each exercise as a reference, meet countdown
  card if a `meet_date` is set. For lifts tied to a training max, shows the prescribed
  weight (% of TM) and a Hit/Miss button that auto-adjusts the training max (~4% bump on
  hit, holds flat on miss). Programming/Coaching tier clients can edit their own program
  (`/program/edit`); free tier is read-only with an upgrade prompt.
- **Progress** (`/progress`): log new body-measurement check-ins and new PRs; line charts
  for weight trend, waist trend, and per-lift PR history (auto-includes any lift that's
  ever appeared, not a hardcoded list).
- **Achievements/Badges** (`/achievements`): full badge catalog with earned/locked state,
  real icons (flag/flame/dumbbell/trophy/calendar/target), earn date. An achievement
  unlock triggers a full-screen toast at the moment it's earned.
- **Messages** (`/messages`): two-way thread with the coach. **Coaching tier only** — free
  and Programming tiers see an upgrade prompt instead.
- **Billing** (`/billing`): opens the Stripe customer billing portal to manage/cancel a
  subscription.
- **Settings** (`/settings`): change password, and (new) enable/disable push
  notifications on the current device.
- All logging forms (workout sets, measurements, PRs) have **local-first draft autosave**
  — drafts persist to `localStorage` immediately and sync to the server in the
  background, with a fallback fetch to recover a draft on a new device if local storage
  is empty. Protects against losing a half-filled workout log to a flaky connection.

## 6. Coach-facing features

Top nav (desktop) / bottom tab bar (mobile, added recently): **All Clients · Templates ·
Settings**.

- **All Clients overview** (`/coach`): grid of every client — name, goal, tier badge,
  subscription status badge, streak/this-week/total-workouts mini-stats. **Updates live**
  via Supabase Realtime (subscribes to `workout_logs`, `measurements`, `prs`, `profiles`
  changes) — no refresh needed when a client logs something. **New:** clients who've gone
  7+ days (amber) or 14+ days (red) without activity are flagged with a day-count badge,
  auto-sorted to the top of the grid, plus a "N need a check-in" toggle to filter to just
  those clients.
- **Client detail view** (`/coach/clients/[id]`), tabbed: Overview (edit profile fields,
  manually change tier — doesn't touch Stripe, send a password-reset email, deactivate/
  reactivate), Program (view assigned program, swap to a different template), Progress
  (weight chart, PR history), History (full workout log history, expandable per entry),
  Badges (achievements earned), Messages (the same two-way thread the client sees).
- **Client management**: create a new client account (name + email, sends a password-set
  invite email, defaults to free tier); deactivate/reactivate; swap a client's assigned
  program at any time (only affects that client — templates and client copies are
  decoupled).
- **Program template editor** (`/coach/templates`, `/coach/templates/[id]`): edit the four
  starter templates' exercises/sets/reps/structure without code changes. Editing a shared
  template only affects newly-onboarded clients going forward.
- **Notes/messaging**: respond to any client's message thread from the client detail view.

## 7. Monetization (Stripe, live mode)

Three tiers, self-serve checkout from `/pricing`:

| Tier | Price | Includes |
|---|---|---|
| Free | $0 | Template program, full workout logging, progress tracking, achievements |
| Programming | $10/week | + edit your own program (exercises/sets/reps/RPE) |
| Coaching | $50/week | + direct messaging with Jon, Jon customizes your program directly, priority feedback |

Stripe webhook (`/api/stripe/webhook`) keeps `profiles.tier` and `subscription_status` in
sync automatically on checkout completion, subscription updates/cancellation, and failed
payments. The coach can also manually override a client's tier from the client detail view
(explicitly *not* wired to Stripe — for comps/grandfathering, not a substitute for a real
subscription).

## 8. Achievements / gamification

Rules engine (`src/lib/achievements.ts`) — small, independent, testable rule functions run
after every workout/measurement/PR log:

- First workout logged
- 10 / 25 / 50 total workouts logged
- 4-week / 8-week consecutive logging streak (a week "counts" with ≥1 completed workout)
- New PR on any lift (beats prior best for that lift)
- First measurement check-in landing 30+ days after the first-ever check-in
- Goal-specific milestone: fat-loss (−10 lb from starting weight), powerlifting (1000 lb
  combined squat/bench/deadlift), strength-gain (any lift ≥1.5x bodyweight), hybrid (15
  workouts logged)

Not yet built: a way for the coach to manually award a one-off custom achievement.

## 9. Push notifications (added most recently)

- Client and coach can opt in from Settings (per-device — browser permission + a stored
  Web Push subscription).
- **Event-driven:** a new message on either side of the coach_notes thread pushes
  immediately to the recipient.
- **Scheduled:** a daily Vercel Cron job (`/api/cron/nudge`, `0 14 * * *` UTC) checks every
  active client's days-since-last-activity and pushes once when they cross the 7-day or
  14-day mark (tracked via `profiles.last_nudge_threshold` so it doesn't repeat daily;
  resets once they log again). Mirrors the in-app dashboard nudge banner, but reaches the
  client even if they haven't opened the app.
- iOS requires 16.4+ and the app installed to the home screen (not a Safari tab) for push
  to work at all — a platform constraint, not an app bug.

## 10. PWA specifics

- `public/manifest.json` + `public/sw.js`, registered from the root layout.
- Installable to home screen on iOS Safari and Android Chrome, launches full-screen.
- Service worker caches the app shell for offline resilience (network-first, falls back
  to cache) and handles incoming push events + notification taps (opens/focuses the
  right URL).

## 11. Recent session's enhancements (context: what just shipped)

1. **Coach: at-risk client flagging** — quiet-client badges + auto-sort + filter toggle
   on the All Clients grid.
2. **Client: dashboard nudge banner** — in-app reminder when a client's gone quiet or
   never logged a workout.
3. **Richer achievement icons** — replaced first-letter circle placeholders with real
   icons across the badges page, coach client-detail view, and unlock toast.
4. **Push notifications** — full opt-in flow, message push, and the inactivity-nudge cron
   job described above.
5. **Mobile nav bug fixes** — client bottom nav (7 items) was overflowing phone width with
   no way to scroll, silently hiding "Settings"; coach nav was hiding its links *entirely*
   below a breakpoint on phones (only logo + Log Out visible). Both fixed: client nav
   scrolls horizontally now, coach nav gets a proper mobile bottom tab bar.

## 12. Ideas discussed but not (yet) built

From an earlier brainstorming pass, still open for a future round:

- **Coach:** manual custom-achievement award, private coach-only notes (separate from the
  client-visible thread), a business/revenue rollup view (MRR, past-due count by tier), a
  meet-date roster view (who has a powerlifting meet coming up across all clients), bulk
  actions from the All Clients grid (message multiple clients at once, filter by tier/goal).
- **Client:** progress photos (was in the original spec's "optional future" list, not
  built — no `photo_url` column exists), a one-way announcement feed for free/Programming
  tiers who don't get full messaging access, body-fat % tracking.

## 13. Architecture conventions worth knowing

- **RLS-first:** almost every read/write goes through a request-scoped Supabase client
  that carries the user's session (`supabaseForRequest()` in `src/lib/supabase/server.ts`)
  so Postgres RLS does the real access control. A separate `supabaseAdmin()` service-role
  client (bypasses RLS) is used only for privileged server-only operations: coach-initiated
  account creation, Stripe webhook writes, and push notification sending/lookup.
  Never used client-side.
- **Realtime auth timing:** the coach overview explicitly calls
  `supabase.realtime.setAuth(session.access_token)` before subscribing — doing this after
  `.subscribe()` loses a race in supabase-js and silently drops every row under RLS even
  though the channel reports itself connected.
- **No staging environment:** this `.env.local` points at Jon's real production Supabase
  project and live-mode Stripe keys — there's no separate sandbox to test destructive
  changes against.
- **Training max formula:** working weight = round(TM × %/5) × 5 (nearest 5 lb); a "hit"
  bumps TM by ~4% (same rounding), a "miss" holds it flat.
- **Draft autosave:** local-first (`localStorage`) + background server sync
  (`useDraftSync` hook, `/api/drafts`), with a server-fallback fetch on empty local
  storage so a client switching devices mid-entry doesn't lose a draft.
