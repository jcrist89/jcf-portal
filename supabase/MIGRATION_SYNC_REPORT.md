# Migration Sync Report — 2026-08-02

## Summary

Production (`xdztfuocalvpdmmvsxaw`) had **18 applied migrations**; the repo had **13 files**.
Six migrations were applied directly to production (dashboard/CLI) and never committed:
`add_default_template_flag`, `add_tier_billing_and_signup_support`, `make_username_optional`,
`drop_pin_auth_columns`, `protect_privileged_profile_columns`, `form_drafts_staging_table`.

This audit read every table, column, index, constraint, function, trigger, RLS policy, grant, and
Realtime publication membership directly from the live database (read-only) and compared it against
the checked-in migrations and application code. New migration files (`0014`–`0021`) were added to
bring the repo back in sync. **None of these have been applied to production** — every statement is
idempotent (`IF NOT EXISTS` / `DROP ... IF EXISTS` / `CREATE OR REPLACE`) and is a no-op against the
live database, which already has this schema. They exist so the repo accurately documents reality
and so a fresh environment (disaster recovery, staging, a new contributor) can reach the same state.

## What was missing, and what was added

| Migration | Reconstructs live migration | What it adds |
|---|---|---|
| `0014_add_tier_billing_and_signup_support.sql` | `add_tier_billing_and_signup_support` (2026-07-26) | `profiles.email/tier/stripe_customer_id/stripe_subscription_id/subscription_status`, `has_tier()` function, `handle_new_auth_user()` function + `on_auth_user_created` trigger on `auth.users`, widened `programs_select`/`programs_update` RLS (client self-access + self-edit), tier-gated `coach_notes` RLS |
| `0015_make_username_optional.sql` | `make_username_optional` | Drops `NOT NULL` on `profiles.username` |
| `0016_drop_pin_auth_columns.sql` | `drop_pin_auth_columns` | Drops `profiles.pin_hash` |
| `0017_protect_privileged_profile_columns.sql` | `protect_privileged_profile_columns` | `protect_profile_privileged_columns()` trigger function blocking self-service changes to `role`/`tier`/Stripe ids/`is_active` |
| `0018_form_drafts_staging_table.sql` | `form_drafts_staging_table` | `form_drafts` table (draft-autosave backing store) + RLS + grants |
| `0019_add_default_template_flag.sql` | `add_default_template_flag` | `programs.is_default_template`, partial unique index (one default per goal), backfill of the four original seed templates |
| `0009_meet_training_maxes.sql` (edited) | — | Prepended `CREATE TABLE IF NOT EXISTS training_maxes (...)` — this table was never formally created in any migration, only ever `ALTER TABLE`'d. No-op in production; fixes fresh-bootstrap failure. **This is the one exception to "don't touch old migrations" in this engagement** — justified because it doesn't change production's already-applied effect at all, and leaving it would make the migration history permanently non-bootstrappable. |
| `0020_training_maxes_rls.sql` | *(new, not a reconstruction)* | RLS policies for `training_maxes` — it had RLS **enabled with zero policies** in production, meaning no RLS-bound client could read/write it at all (only reachable via the service-role client). Purely additive defense-in-depth; the working admin-client path is untouched. |
| `0021_harden_grants_and_function_exposure.sql` | *(new, not a reconstruction)* | Revokes unnecessary `anon` table grants and `anon`/`authenticated` EXECUTE on the two trigger-only functions; drops a duplicate unique constraint on `training_maxes`. See "Not yet applied" below — recommended but flagged for verification before use. |

## Corrected a repo-only misread

One audit pass, working from the repo alone, concluded the client program-self-edit RLS policy was
missing in production (i.e. that "Programming/Coaching tier clients can edit their own program" was
silently broken). **Direct query against the live database disproves this** — the real
`programs_update` policy already includes the client self-edit clause (see `0014`). It's not broken,
it was only undocumented. Flagging this explicitly since it's the kind of thing that would otherwise
lead to "fixing" a feature that already works.

## Other confirmed findings, not migrated

- **`src/lib/types.ts`** was hand-written, not generated. Reconciled against a live-generated
  `Database` type (via `generate_typescript_types`) — every field matched exactly except
  `Profile.last_nudge_threshold` (missing) and no `FormDraft` interface existed. Both added. The
  generated type is now also saved at `src/lib/supabase/database.types.ts` as a reference/drift
  check for future codegen; `types.ts` remains the app's actual import source (lower blast radius
  than swapping every import site).
- **Security advisor findings** (Supabase `get_advisors`): `is_coach`/`has_tier`/
  `handle_new_auth_user`/`protect_profile_privileged_columns` are `SECURITY DEFINER` and directly
  callable via PostgREST RPC by `anon`. Addressed for the two trigger-only functions in `0021`
  (safe — trigger firing doesn't need EXECUTE). Left alone for `is_coach`/`has_tier` since they're
  invoked inside RLS policy expressions and revoking `anon` EXECUTE risks turning a harmless
  "no rows" result into a hard permission error for any incidental anon-key request — not worth the
  risk without a way to test it first.
- **"Leaked password protection" is disabled** in Supabase Auth settings. This is an Auth dashboard
  toggle, not a migration — **manual action required**: Supabase Dashboard → Authentication →
  Policies → enable "Leaked password protection" (checks against HaveIBeenPwned). Not performed by
  this engagement.

## Production checks recommended before this is ever applied elsewhere

1. Diff `0014`–`0021` against a fresh `supabase db diff` (or equivalent) run against a disposable
   Supabase branch/project, since this repo has no local Supabase/Docker stack to test against.
2. Confirm `0021`'s `anon` grant revocation doesn't break anything by testing sign-in, signup, and
   the coach Realtime dashboard against that same disposable environment before ever running it
   against production (which already effectively has this behavior via RLS — the revoke only
   removes the unused standing grant, but verify before trusting that assumption blind).
3. Toggle the leaked-password-protection Auth setting manually (see above).
4. Re-run `get_advisors` after applying `0021` to confirm the flagged warnings clear and no new ones
   appear.

## Not applied to production

Per instructions, none of `0009` (edit) or `0014`–`0021` have been run against the live project.
They exist only as repo files, ready for review and, when authorized, `supabase db push`.
