# JCF Portal — Setup Guide

Next.js 14 + Supabase app for Jon Crist Fit. This doc reflects the app's actual current
state (see [APP_OVERVIEW.md](APP_OVERVIEW.md) for the full feature picture,
[AUTHORIZATION.md](AUTHORIZATION.md) for the server-side access-control model, and
[supabase/MIGRATION_SYNC_REPORT.md](supabase/MIGRATION_SYNC_REPORT.md) for the database
history).

> **Obsolete PIN-auth instructions removed.** Earlier versions of this doc described a
> custom username + PIN login scheme. That was replaced by real Supabase Auth
> (email + password) — see "Authentication" below. If you find PIN-related instructions
> anywhere else in this repo, they're stale.

## 1. Authentication

Real Supabase Auth, email + password, via `@supabase/ssr` cookie-based sessions
(`src/lib/supabase/server.ts`). Two roles, stored on `profiles.role`: `coach` and
`client`.

- **Public self-signup** exists at `/signup` — anyone can create a free-tier account
  directly. Paid tiers go through Stripe Checkout first; the account is created
  immediately but stays on `tier: free` until the webhook confirms payment.
- **Coach-invited clients**: the coach creates an account from `/coach` (All Clients →
  + New Client), which sends a Supabase Auth invite email. The client sets their own
  password via the link.
- **Password reset**: `/forgot-password` → emailed link → `/reset-password`.
- A Postgres trigger (`handle_new_auth_user`, see migration `0014`) provisions the
  matching `profiles` row the instant a `auth.users` row is created — for both the
  self-signup and invite paths.
- Row Level Security is enabled on every table. `is_coach(uid)` and `has_tier(uid,
  tiers)` (both in migration `0014`) are the two building-block functions almost every
  policy uses. See AUTHORIZATION.md for the full endpoint-by-endpoint access model.

## 2. Roles & subscription tiers

| Tier | Price | Includes |
|---|---|---|
| `free` | $0 | Template program, full workout logging, progress tracking, achievements |
| `paid_programming` | $10/week | + edit your own program |
| `paid_coaching` | $50/week | + direct messaging with the coach, coach-customized program |

The coach can manually override a client's tier from the client detail view — this is
**not** wired to Stripe (for comps/grandfathering), which is why `stripe_customer_id`
can be null on a paid-tier profile; the billing page handles that case explicitly.

## 3. Local setup

```bash
npm install
npm run dev
```

Copy `.env.local.example` to `.env.local` and fill in real values — see the next
section for what each variable is for. **There is no separate staging environment or
Supabase project for local development** — `.env.local` points at the real production
Supabase project and live-mode Stripe keys. There is currently no local/sandboxed
Supabase stack (no `supabase start` / Docker setup checked in). Be deliberate about
anything that writes data while developing locally.

## 4. Required environment variables

Names only — get actual values from Supabase/Stripe/Vercel dashboards, never commit
real values. See `.env.local.example` for the full annotated list.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  — Supabase project settings → API. The service-role key is server-only (see
  `src/lib/supabase/admin.ts`) — never expose it to the client.
- `NEXT_PUBLIC_SITE_URL` — the real deployed origin, used to build email redirect links.
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe Developers → API
  keys (live mode).
- `STRIPE_WEBHOOK_SECRET` — from the Stripe webhook endpoint config (section 6).
- `STRIPE_PRICE_ID_PROGRAMMING`, `STRIPE_PRICE_ID_COACHING` — the live Stripe Price ids
  for the two paid tiers.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_CONTACT_EMAIL` — Web Push
  (section 7).
- `CRON_SECRET` — shared secret protecting `/api/cron/nudge`; Vercel Cron sends it
  automatically as `Authorization: Bearer <value>` once set.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — the app's own
  transactional email (currently: the tier-based welcome email, `src/lib/email/
  sendWelcome.ts`). Separate from Supabase Auth's own SMTP config (used for invite/
  reset-password emails, set in the Supabase Dashboard under Authentication → Email
  Templates/SMTP) — both can use the same mailbox but need their own credentials
  entered in their respective places.

## 5. Supabase setup & migration procedure

Migrations live in `supabase/migrations/`, applied in filename order. **Before applying
any migration to a project, read `supabase/MIGRATION_SYNC_REPORT.md`** — as of this
writing, several migrations in that directory (`0014`–`0023`) reconstruct schema/policy
changes that were applied directly to the production project outside of version
control; every statement in them is written `IF NOT EXISTS`/idempotent specifically so
re-running them against that same production project is a safe no-op, but they have
**not** been verified against a fresh/empty database.

For a genuinely new project:
```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```
Or apply each file in `supabase/migrations/` in order via the SQL Editor.

After migrating, regenerate TypeScript types to catch drift early:
```bash
supabase gen types typescript --project-id YOUR-PROJECT-REF > src/lib/supabase/database.types.ts
```
`src/lib/supabase/database.types.ts` is the generated reference; `src/lib/types.ts` is
the app's actual (hand-written, manually kept in sync) type source. If they ever
diverge, `database.types.ts` is the source of truth for what's actually in the
database.

**Manual dashboard steps not covered by any migration** (see MIGRATION_SYNC_REPORT.md
for the full list): enabling "Leaked password protection" under Authentication →
Policies is recommended and has not been enabled.

## 6. Stripe webhook setup

1. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   `https://YOUR-DOMAIN/api/stripe/webhook`.
2. Subscribe to: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. The handler (`src/app/api/stripe/webhook/route.ts`) verifies the signature, is
   idempotent per event id (`stripe_events` table, migration `0022`), and re-derives
   `profiles.tier` from the subscription's actual current price on
   `customer.subscription.updated` — so plan changes made via the Stripe customer
   portal (which the app's own `/billing` page can open) stay in sync.

## 7. Email & push-notification setup

- **Transactional email** (welcome email): SMTP credentials as listed above
  (`src/lib/email/sendWelcome.ts`, `nodemailer`).
- **Supabase Auth email** (invites, password resets): configured separately in the
  Supabase Dashboard under Authentication → Email Templates / SMTP settings — this is
  a different config surface from the app's own SMTP vars above.
- **Web Push**: generate a VAPID key pair once with `npx web-push generate-vapid-keys`,
  set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` the same in both `.env.local`
  and Vercel. iOS requires 16.4+ with the app installed to the home screen (Safari-tab
  push doesn't work — a platform constraint).

## 8. Scheduled jobs

One Vercel Cron job, defined in `vercel.json`:

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/nudge` | `0 14 * * *` (daily, 14:00 UTC) | Pushes an inactivity nudge to clients quiet 7+/14+ days; also runs a lightweight paid-tier/subscription-status consistency check and logs anything suspicious to `event_log` (see Monitoring below). |

Protected by `CRON_SECRET`. Failures are logged to `event_log`, visible at
`/coach/monitoring`, not just Vercel's raw function logs.

## 9. Testing

```bash
npm run test          # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage
npm run lint           # ESLint (also runs automatically during `npm run build`)
```

Vitest, config at `vitest.config.ts`. Tests never touch the real Supabase project or
live Stripe keys — route-handler tests mock `@/lib/supabase/server` / `@/lib/supabase/
admin` / `@/lib/stripe` and use an in-memory fake query builder
(`src/test/fakeSupabase.ts`), not a real database connection. Some flows (real RLS
enforcement, real Stripe webhook delivery, real email/push delivery) can't be fully
exercised by this test layer — those are verified by direct, read-only inspection of
the live Supabase project's policies/functions and by manual/browser testing, not by
the automated suite. Say so explicitly if you extend this suite and hit the same
limit rather than mocking around it in a way that stops testing anything real.

## 10. Deployment

- **Frontend**: push to GitHub, import into Vercel, set the same environment variables
  from `.env.local` in the Vercel project settings. `next.config.js` no longer disables
  ESLint during builds — a lint error will fail the build (this was previously silently
  skipped).
- **Backend**: Supabase project, already live — migrations applied via `supabase db
  push` or the SQL Editor (see section 5). No separate deploy step.

## 11. Recovery & troubleshooting

- **Stripe webhook delayed or never arrives**: the account exists immediately on
  `tier: free`; nothing breaks, it just doesn't upgrade until the webhook lands. The
  `/onboarding?checkout=success` redirect shows a "activating your plan" banner that
  polls briefly (`src/components/CheckoutStatusBanner.tsx`) and a manual refresh
  fallback. Check `/coach/monitoring` for `stripe.webhook` errors if a client reports
  this persisting.
- **Duplicate webhook delivery**: handled by the `stripe_events` idempotency ledger —
  a repeat delivery short-circuits to `{ duplicate: true }` without reprocessing.
- **Browser closed during checkout**: the Stripe Checkout session simply expires;
  nothing to clean up. The account (created before Checkout redirect) stays on
  `tier: free`.
- **Authenticated user with incomplete onboarding**: `requireUser("client")`
  (`src/lib/auth/require.ts`) redirects to `/onboarding` automatically for every client
  page that requires the client role.
- **Paid subscription showing the wrong tier**: check `/coach/monitoring` for
  `cron.tier_mismatch` warnings (daily check) or `stripe.webhook` errors around
  `subscription.updated`. Confirm the profile's `stripe_subscription_id` and
  `subscription_status` against the Stripe Dashboard directly if needed.
- **Expired/used coach invite or reset link**: `/reset-password` shows a clear "Link
  Expired" state with a button back to `/forgot-password` — this is Supabase Auth's own
  invite-link expiry, not a custom mechanism.
- **Missing Stripe metadata on a webhook event**: logged to `event_log`
  (`stripe.webhook`, level `error`/`warning`) with enough context to investigate
  without exposing card/payment details.
