# JCF Portal — Setup Guide

This is a complete Next.js + Supabase scaffold for Jon Crist Fit. Everything is built and
type-checked; you just need to connect your own Supabase project and deploy.

## 1. Create a Supabase project

1. Go to https://supabase.com, create a free project.
2. In **Project Settings > API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret, server-only)
3. In **Project Settings > API > JWT Settings**, copy the `JWT Secret` → `SUPABASE_JWT_SECRET`.
   (This app mints its own Supabase-compatible JWTs after verifying a client's PIN, so
   Row Level Security still works without using Supabase Auth's own user table.)

## 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the values above, plus generate a
random string for `SESSION_COOKIE_SECRET` (e.g. `openssl rand -base64 32`).

## 3. Run the database migrations

In the Supabase dashboard, open the **SQL Editor** and run the files in `supabase/migrations/`
**in order** (0001 → 0005). They create the schema, Row Level Security policies, the four
starter program templates, enable Realtime on the tables the coach dashboard subscribes to,
and seed Jon's coach login.

Alternatively, with the Supabase CLI installed and linked to your project:
```
supabase db push
```

## 4. First login

Default coach login: **username `jon`, PIN `194756`**.
**Log in and change this PIN immediately** via Settings > Change PIN.

Jon creates every client account from the coach dashboard (All Clients > + New Client) —
there's no public signup. Each new client gets an auto-generated 6-digit PIN shown once;
share it with them however you like (text, in person, etc).

## 5. Run locally

```
npm install
npm run dev
```

## 6. Deploy

- **Frontend:** push this repo to GitHub and import it into Vercel. Add the same environment
  variables from `.env.local` in the Vercel project settings.
- **Backend:** already live on Supabase — nothing else to deploy.

## 7. Install as an app (PWA)

Once deployed, open the site on a phone:
- **iOS Safari:** Share > Add to Home Screen
- **Android Chrome:** menu (⋮) > Add to Home Screen / Install App

It'll launch full-screen with the JCF icon, no browser chrome.

## 8. Drop in the real logo

The UI currently uses a styled "JCF" text mark as a placeholder everywhere (header, login,
app icon). When you have the logo file:
- Replace `public/icons/icon-192.png`, `icon-512.png`, and `maskable-512.png` with real
  exports of your mark (same filenames/sizes, or update `public/manifest.json` if you
  rename them).
- Swap the markup in `src/components/JcfLogo.tsx` for an `<Image>` tag pointing at your
  logo file instead of the styled text.

## Notes on the placeholder program templates

The four starter programs (Strength Gain, Fat Loss, Hybrid, Powerlifting) in
`supabase/migrations/0003_seed_programs.sql` are realistic but generic — edit them anytime
from the coach dashboard under **Templates**, no code changes needed. Editing a shared
template only affects newly-onboarded clients; each client gets their own copy of the
program the moment they select a goal, so you can freely customize one client's plan
without touching anyone else's.

## Architecture notes

- **Auth:** username + 4-6 digit PIN, bcrypt-hashed, stored only in `profiles.pin_hash`.
  No email/password, no Supabase Auth users table involved. A signed httpOnly session
  cookie keeps clients logged in on their device for 90 days.
- **Row Level Security:** every table has RLS enabled. Clients can only read/write their
  own rows; the coach (`profiles.role = 'coach'`) can read/write everything, enforced by
  the `is_coach()` Postgres function in `0002_rls.sql`.
- **Realtime:** the coach's "All Clients" dashboard subscribes to Postgres change events
  on `workout_logs`, `measurements`, `prs`, and `profiles` — when a client logs anything,
  it updates live with no refresh needed.
- **Achievements:** `src/lib/achievements.ts` has small, independent rule functions
  (first workout, streaks, workout-count milestones, new PRs, 30-day check-in, goal
  milestones) run after every workout/measurement/PR log via `checkAndAwardAchievements`.
