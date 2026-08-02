-- Reconstructs a migration applied directly to production on 2026-07-26 (live
-- version 20260726041803, name "protect_privileged_profile_columns"). No-op
-- against production; documents reality for a fresh environment.
--
-- profiles_update RLS (0002_rls.sql) lets a user update their own row — necessary
-- for self-service profile edits (name, birthday, weight, goal, etc.) — but that
-- also technically allows a client to rewrite their own role/tier/Stripe ids/
-- is_active via a direct PostgREST request. This trigger blocks changes to those
-- specific privileged columns unless the caller is the coach or the service role
-- (Stripe webhook, coach-admin routes use supabaseAdmin() and run as service_role).
create or replace function protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_coach(auth.uid()) then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.tier is distinct from old.tier
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.subscription_status is distinct from old.subscription_status
     or new.is_active is distinct from old.is_active
  then
    raise exception 'Not permitted to modify privileged profile fields';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_columns_trg on profiles;
create trigger protect_profile_privileged_columns_trg
  before update on profiles
  for each row execute function protect_profile_privileged_columns();
