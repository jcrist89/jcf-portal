-- Release hardening for public helper functions identified by the Supabase
-- security advisor. RLS policies only ask these helpers about auth.uid(), so
-- reject arbitrary UUID probes at the function boundary as defense in depth.

create or replace function public.is_coach(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and uid = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where id = uid and role = 'coach' and is_active = true
    );
$$;

create or replace function public.has_tier(uid uuid, allowed_tiers text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and uid = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where id = uid and tier = any(allowed_tiers)
    );
$$;

revoke execute on function public.is_coach(uuid) from public, anon;
revoke execute on function public.has_tier(uuid, text[]) from public, anon;
grant execute on function public.is_coach(uuid) to authenticated;
grant execute on function public.has_tier(uuid, text[]) to authenticated;

-- slugify only uses pg_catalog functions, so it does not need a mutable path.
alter function public.slugify(text) set search_path = '';
