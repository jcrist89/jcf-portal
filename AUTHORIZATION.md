# Server-Side Authorization Reference

Every route handler reviewed during the 2026-08 hardening pass, and the access rule it enforces.
Two layers matter here: **app-level checks** (in the route handler itself) and **RLS** (enforced by
Postgres regardless of the app code, for anything using the request-scoped client — see
`src/lib/supabase/server.ts`). Routes using the service-role client (`src/lib/supabase/admin.ts`)
bypass RLS entirely, so those *must* have a correct app-level check — there's no database backstop.

Shared helpers live in `src/lib/auth/authorize.ts`: `requireSession`, `requireCoach`,
`resolveProfileId`, `requireOwnerOrCoach`, `requireTier`, `requireExistingClient`.

## Auth
| Route | Rule |
|---|---|
| `POST /api/auth/login` | Public (this is the login endpoint). |
| `POST /api/auth/logout` | Signs out the current session cookie; no check needed. |
| `POST /api/signup` | Public self-signup. Tier is user-selected but only picks the Stripe price; `profiles.tier` isn't actually granted until the webhook confirms payment. |

## Client self-service
| Route | Rule |
|---|---|
| `POST /api/profile` (onboarding) | Requires a session; all writes scoped to the caller's own id. |
| `PATCH /api/profile` | Requires a session; scoped to the caller's own id; allow-listed fields only. |
| `POST/GET/DELETE /api/drafts` | Requires a session; scoped to `profile_id = caller`. |
| `POST/DELETE /api/push/subscribe` | Requires a session; scoped to `profile_id = caller`. |
| `GET /api/compliance?profileId=` | Requires a session; caller must own `profileId` or be the coach. |

## Client-or-coach-on-behalf-of routes
`measurements`, `prs`, `workouts`, `readiness`, `joker-requests` (POST), `notes` (POST/PATCH) all use
`resolveProfileId(ctx, body.profileId)`: a client always acts on their own profile no matter what's
in the request body; a coach may act on any profile by supplying `profileId`. Enforced identically
by RLS (`profile_id = auth.uid() or is_coach(auth.uid())`) as defense-in-depth.

- **`POST /api/notes`** additionally requires `requireTier(profileId, ["paid_coaching"])` —
  messaging is a Coaching-tier feature. Also enforced at the RLS layer
  (`coach_notes_insert`/`_select`/`_update` require `has_tier(paid_coaching)` for a client-authored
  row) — the app check exists to return a clean 403 instead of a raw RLS error, and as a backstop.
- **`PATCH /api/joker-requests/[id]`**: `approved`/`denied` transitions require `session.role ===
  "coach"`. `completed`/`failed_compliance` transitions require the caller to own the request or be
  the coach — checked explicitly in the route (previously relied on RLS alone).

## Coach-only
| Route | Rule |
|---|---|
| `POST /api/clients` | `role === "coach"`. Creates the auth user + profile via the service-role client. |
| `PATCH/DELETE /api/clients/[id]` | `role === "coach"`, **plus** `requireExistingClient` confirms `params.id` is an actual `client`-role profile before the service-role write proceeds. |
| `PATCH /api/training-maxes` | `role === "coach"`, **plus** `requireExistingClient` on `body.profileId` before the service-role upsert. |
| `PATCH /api/templates/[id]` | No app-level role check by design — relies entirely on the `programs_update` RLS policy (coach can edit anything; a paid-tier client can edit their own non-template row). A rejected RLS write surfaces as a 403 here. |

## System-triggered
| Route | Rule |
|---|---|
| `GET /api/cron/nudge` | Requires `Authorization: Bearer <CRON_SECRET>`. Runs as the service-role client across all clients — appropriate for a batch job, no per-row authz needed. |
| `POST /api/stripe/webhook` | Requires a valid Stripe signature (`stripe-signature` header + `STRIPE_WEBHOOK_SECRET`). Idempotent via a `stripe_events(id)` ledger — a duplicate event id short-circuits to a 200 without reprocessing. Re-derives `tier` from the subscription's actual Stripe price on `customer.subscription.updated` (not just `subscription_status`), so a plan change via the Stripe customer portal keeps app-level entitlements in sync. |

## Billing
| Route | Rule |
|---|---|
| `POST /api/stripe/portal` | Requires a session; `stripe_customer_id` is read from the caller's **own** profile row only — never accepts a customer id from the request. |

## Database-level (RLS), independent of any route
- `training_maxes` now has explicit RLS policies (previously enabled with zero policies — no
  RLS-bound client could read/write it at all). Purely additive; the coach-only admin-client route
  above still works exactly as before.
- `profiles_update` allows self-update of any column, but the `protect_profile_privileged_columns`
  trigger blocks a non-coach, non-service-role caller from changing `role`, `tier`,
  `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, or `is_active` on their own
  row — even via a direct PostgREST request that bypasses the app entirely.

## Known, accepted residual risk
- `clients/[id]` and `training-maxes` still trust a caller-supplied target id beyond confirming it's
  a real client profile — there's no per-coach ownership scoping, because the app has exactly one
  coach today. If the app ever supports multiple coaches with separate rosters, these routes need a
  real ownership check, not just an existence check.
- `middleware.ts` only refreshes the session cookie; it does not gate any route. All actual page
  protection is per-page via `requireUser()` in `src/lib/auth/require.ts`, confirmed present on
  every page that needs it — but this is enforced by convention, not centrally, so a newly added
  page that forgets to call it would be unprotected with no framework-level safety net.
