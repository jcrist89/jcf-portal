-- Reconstructs a migration applied directly to production on 2026-07-26 (live
-- version 20260726030909, name "add_tier_billing_and_signup_support") but never
-- committed to this repo. Written verbatim from the live schema/policy/function
-- definitions captured during the 2026-08 migration-sync audit (columns, policy
-- qual/with_check text, and function bodies were read directly from the live
-- database, not guessed). This is a no-op against production (already applied
-- there) — it exists so the repo's migration history matches reality and a fresh
-- environment can reach the same state.
--
-- This is also the migration that moved auth from the old username+PIN scheme
-- (see 0002_rls.sql's now-stale header comment) to real Supabase Auth: profiles.id
-- is now the same uuid as auth.users.id, and auth.uid() resolves accordingly.

alter table profiles add column if not exists email text unique;
alter table profiles add column if not exists tier text not null default 'free'
  check (tier in ('free','paid_programming','paid_coaching'));
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists stripe_subscription_id text;
alter table profiles add column if not exists subscription_status text not null default 'n/a'
  check (subscription_status in ('active','past_due','canceled','n/a'));

-- Tier-gate helper, mirrors is_coach()'s pattern (0002_rls.sql).
create or replace function has_tier(uid uuid, allowed_tiers text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and tier = any(allowed_tiers)
  );
$$;

-- Provisions a profiles row the moment a Supabase Auth user is created — covers
-- both public self-signup (/api/signup) and coach-sent invites
-- (auth.admin.inviteUserByEmail from /api/clients). The app's signup/invite routes
-- then update the row (tier, name, etc.) after this insert.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, email, tier, onboarded, is_active)
  values (new.id, 'client', new.email, 'free', false, true)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- programs: widen select so any authenticated user can see shared templates
-- (client_id is null) or their own per-client copy; allow paid-tier clients to
-- update (not insert/delete) their own non-template program. Supersedes the
-- coach-only programs_select/programs_update policies from 0002/0006.
drop policy if exists programs_select on programs;
create policy programs_select on programs for select
  using (client_id is null or client_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists programs_update on programs;
create policy programs_update on programs for update
  using (
    is_coach(auth.uid())
    or (client_id = auth.uid() and is_template = false
        and has_tier(auth.uid(), array['paid_programming','paid_coaching']))
  );

-- coach_notes: messaging is a Coaching-tier feature — gate client-side access at
-- the database layer, not just in the UI/app routes. Supersedes 0002's policies.
drop policy if exists coach_notes_select on coach_notes;
create policy coach_notes_select on coach_notes for select
  using (is_coach(auth.uid()) or (profile_id = auth.uid() and has_tier(auth.uid(), array['paid_coaching'])));

drop policy if exists coach_notes_insert on coach_notes;
create policy coach_notes_insert on coach_notes for insert
  with check (
    (is_coach(auth.uid()) and author = 'coach')
    or (profile_id = auth.uid() and author = 'client' and has_tier(auth.uid(), array['paid_coaching']))
  );

drop policy if exists coach_notes_update on coach_notes;
create policy coach_notes_update on coach_notes for update
  using (is_coach(auth.uid()) or (profile_id = auth.uid() and has_tier(auth.uid(), array['paid_coaching'])));

grant execute on function has_tier(uuid, text[]) to authenticated, anon;
