-- Phase 0 corrections. Three problems, all of them live in production today:
--
--  1. A client's program position was derived as `completedCount % totalDays`, so a
--     block silently restarted at week 1 once it ran out of days and there was no way
--     to answer "what week is this client in?". Adds programs.starts_on so calendar
--     position is a stored fact rather than a workout counter.
--
--  2. The coach's "Swap Program Template" control assigned the shared template row
--     itself (profiles.program_id -> a programs row with is_template = true) instead of
--     copying it the way signup/onboarding do. Editing such a client's program through
--     the coach UI therefore rewrote the shared template every future client is copied
--     from. This migration repairs the affected clients; the server-side fix that stops
--     it recurring is in /api/clients/[id].
--
--  3. Every date was written as UTC (new Date().toISOString().slice(0,10)), so a
--     night-shift client training at 01:30 local had the session recorded on the
--     following day. Adds profiles.timezone.
--
-- Also backfills programs.meet_date as an IF NOT EXISTS guard: it exists in production
-- but was applied out-of-band and appears in no migration, so a fresh bootstrap from
-- this history would break app code that reads it (same situation 0009 documented for
-- training_maxes).

-- ── 1. columns ──────────────────────────────────────────────────────────────

alter table programs add column if not exists meet_date date;

-- The calendar anchor for a client's block. Null on shared templates (a template
-- has no start date; the copy made for a client does).
alter table programs add column if not exists starts_on date;

-- How this program advances. `sequential` serves the next undone session and lets a
-- missed one wait — the right behaviour for a general client who trains around a
-- rotating shift. `date_anchored` follows the calendar and drops a missed session,
-- which is the only correct behaviour for a peaking block that has to land its taper
-- on a fixed competition date.
alter table programs add column if not exists schedule_mode text not null default 'sequential'
  check (schedule_mode in ('sequential', 'date_anchored'));

-- IANA zone. Defaulted rather than left null so no date write has to guess: every
-- existing client is Eastern (the coach's own zone, ca-central-1), and onboarding
-- captures the real value from the browser for anyone new.
alter table profiles add column if not exists timezone text not null default 'America/Toronto';

comment on column programs.starts_on is
  'Calendar anchor for a client program copy. Null for shared templates.';
comment on column programs.schedule_mode is
  'sequential = next undone session, missed sessions wait. date_anchored = follow the calendar, missed sessions are dropped (meet prep).';
comment on column profiles.timezone is
  'IANA timezone. All local_date arithmetic resolves against this, never UTC.';

-- ── 2. backfill starts_on ───────────────────────────────────────────────────
-- Earliest completed workout against the program is the truest start we have;
-- otherwise the row's own creation date.

update programs pr
set starts_on = coalesce(
  (select min(wl.date) from workout_logs wl where wl.program_id = pr.id and wl.completed),
  pr.created_at::date
)
where pr.is_template = false and pr.starts_on is null;

-- A block with a meet date is date-anchored by definition.
update programs set schedule_mode = 'date_anchored'
where meet_date is not null and schedule_mode = 'sequential';

-- ── 3. repair clients assigned to a shared template ─────────────────────────
-- Copies the template into a client-owned row, repoints the profile, and moves any
-- historical workout logs onto the copy so the client's history stays coherent.
-- Guarded by is_template = true, so re-running this is a no-op.

do $$
declare
  r record;
  copied_id uuid;
begin
  for r in
    select p.id as profile_id, pr.id as template_id, pr.goal, pr.name, pr.description,
           pr.structure, pr.meet_date, pr.attempt_plan, pr.weaknesses
    from profiles p
    join programs pr on pr.id = p.program_id
    where pr.is_template = true
  loop
    insert into programs (
      goal, name, description, structure, is_template, is_default_template,
      client_id, meet_date, attempt_plan, weaknesses, starts_on, schedule_mode
    )
    values (
      r.goal, r.name, r.description, r.structure, false, false,
      r.profile_id, r.meet_date, r.attempt_plan, r.weaknesses,
      coalesce(
        (select min(wl.date) from workout_logs wl
          where wl.profile_id = r.profile_id and wl.completed),
        current_date
      ),
      case when r.meet_date is not null then 'date_anchored' else 'sequential' end
    )
    returning id into copied_id;

    update profiles set program_id = copied_id where id = r.profile_id;

    update workout_logs set program_id = copied_id
    where profile_id = r.profile_id and program_id = r.template_id;

    raise notice 'Repaired profile % : template % -> owned copy %',
      r.profile_id, r.template_id, copied_id;
  end loop;
end $$;

-- ── 4. guard against a recurrence at the database layer ─────────────────────
-- The application fix lives in /api/clients/[id], but nothing except convention
-- stopped any other write path from doing the same thing. A profile may only point
-- at a program that is not a shared template.

-- security definer + pinned search_path, matching 0021's hardening: the check must see
-- every programs row regardless of the writer's RLS visibility, and a guard that can be
-- defeated by not being able to see the row it guards against is not a guard.
--
-- PostgREST *does* publish trigger-returning functions at /rest/v1/rpc, so the public
-- EXECUTE grant is revoked below. Calling it that way errors anyway (plpgsql refuses a
-- trigger function invoked outside a trigger), and trigger invocation never consults
-- EXECUTE privileges — so revoking costs the guard nothing.
create or replace function assert_program_is_not_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.program_id is not null
     and exists (select 1 from public.programs where id = new.program_id and is_template = true)
  then
    raise exception
      'profiles.program_id (%) refers to a shared template. Assign a client-owned copy instead.',
      new.program_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.assert_program_is_not_template() from public;
revoke execute on function public.assert_program_is_not_template() from anon;
revoke execute on function public.assert_program_is_not_template() from authenticated;

drop trigger if exists profiles_program_not_template on profiles;
create trigger profiles_program_not_template
  before insert or update of program_id on profiles
  for each row execute function assert_program_is_not_template();
