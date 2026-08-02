-- New (not a reconstruction): least-privilege hardening found during the 2026-08
-- migration-sync audit (Supabase security advisor + direct grant inspection).
-- Nothing here removes access any real request path uses today — the app only
-- ever talks to Postgres as `authenticated` (logged-in session) or `service_role`
-- (server-side admin client, unaffected by table/role grants). No page or route
-- issues requests as `anon`. Recommended to verify against a Supabase branch or
-- staging copy before ever applying to production, since this repo has no local
-- Supabase/Docker stack to test against directly.

-- 1) These two functions are trigger-only (on_auth_user_created,
--    protect_profile_privileged_columns_trg) and are never meant to be called
--    directly. The security advisor flags both as callable via PostgREST RPC
--    (/rest/v1/rpc/handle_new_auth_user, /rest/v1/rpc/protect_profile_privileged_columns)
--    by anon and authenticated. Revoking EXECUTE does not affect trigger firing
--    (Postgres trigger invocation isn't gated by the EXECUTE privilege), so this
--    only closes the direct-RPC-call surface.
revoke execute on function handle_new_auth_user() from anon, authenticated, public;
revoke execute on function protect_profile_privileged_columns() from anon, authenticated, public;

-- 2) is_coach()/has_tier() are intentionally left executable by anon and
--    authenticated: both are invoked inside RLS policy expressions, which are
--    evaluated as the querying role (anon included, for any request made with the
--    anon key before/without a session) — revoking anon EXECUTE here would turn a
--    harmless "no rows" RLS result into a hard permission-denied error for any such
--    request. The residual exposure (anyone can call is_coach(<uuid>) or
--    has_tier(<uuid>, ...) via RPC to check an arbitrary profile's role/tier) is a
--    minor information leak, not an access-control gap, and isn't worth that risk
--    without a way to test the change first.

-- 3) No table here has any legitimate anon-role use case (every page requires a
--    logged-in session; the one pre-login flow, signup, goes through the
--    service-role admin client, not a direct anon-key table write). Revoke the
--    blanket CRUD grants to anon that 0002/0007/0010 handed out alongside
--    `authenticated` — RLS already blocks anon access in practice, this just
--    removes the unnecessary standing privilege.
revoke select, insert, update, delete on
  profiles, programs, measurements, prs, workout_logs, achievements, coach_notes,
  push_subscriptions, readiness_checkins, joker_requests, deviation_reports,
  training_maxes, form_drafts
from anon;

-- 4) Minor cleanup: training_maxes ended up with two identical unique constraints
--    on (profile_id, lift) — training_maxes_profile_id_lift_key (a table-level
--    UNIQUE(profile_id, lift) constraint added out-of-band) and the explicit
--    training_maxes_profile_lift_uidx index this repo's migrations already own
--    (0009_meet_training_maxes.sql). Drop the duplicate constraint (this also
--    drops its backing index); the named index from 0009 remains and continues
--    enforcing the same uniqueness.
alter table training_maxes drop constraint if exists training_maxes_profile_id_lift_key;
