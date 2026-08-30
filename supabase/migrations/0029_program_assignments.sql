-- Program assignments and materialized sessions.
--
-- Today a client's schedule is derived on every render: flatten the program jsonb, count
-- completed logs, index in. That makes "which session is next" a calculation rather than
-- a fact, and leaves nowhere to record that a specific session was missed, scaled, or
-- done on a particular day. Adherence has to be inferred, and a missed session is
-- invisible because nothing represents it.
--
-- Materializing turns each prescribed session into a row with a date and a status. Then
-- today's workout is a lookup, adherence is a count, a missed session is a row with
-- status 'skipped', and a scaled one keeps both the fact that it happened and the fact
-- that it was reduced.
--
-- IMPORTANT: these tables are written but NOT yet read by the app. The client still gets
-- its schedule from programs.structure via programPosition(). This is deliberate — the
-- shadow copy gets verified against the live calculation before anything cuts over, so
-- there is never a window where two sources of truth are both authoritative.
--
-- Drift is managed rather than hoped away: an assignment records the programs.updated_at
-- it was built from, so a stale materialization is detectable, and
-- materialize_assignment_sessions() is re-runnable. Re-running never touches a session
-- that actually happened — only unstarted 'prescribed' rows are replaced.

create table if not exists program_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,

  -- The client-owned program copy this was built from. Never a shared template.
  program_id uuid not null references programs(id) on delete cascade,
  engagement_id uuid references client_engagements(id) on delete set null,

  starts_on date not null,
  timezone text not null default 'America/Toronto',

  -- Mirrors programs.schedule_mode. Copied onto the assignment so a mid-block change to
  -- the program cannot retroactively reinterpret sessions already served.
  schedule_mode text not null default 'sequential'
    check (schedule_mode in ('sequential', 'date_anchored')),

  -- Optional fixed training days (0 = Sunday). Null means the block only knows how many
  -- sessions a week contains, not which days they land on.
  weekday_pattern smallint[],

  status text not null default 'active'
    check (status in ('active', 'superseded', 'completed', 'abandoned')),
  superseded_by uuid references program_assignments(id) on delete set null,

  -- Staleness detection: programs.updated_at at the moment sessions were built.
  materialized_at timestamptz,
  source_updated_at timestamptz,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_active_assignment_per_client
  on program_assignments (profile_id) where status = 'active';

create table if not exists assignment_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references program_assignments(id) on delete cascade,

  -- Denormalised from the assignment so RLS and the hot "what is due today" lookup do
  -- not need a join.
  profile_id uuid not null references profiles(id) on delete cascade,

  week_number int not null,
  day_number int not null,
  -- Flat position across the whole block, so "next undone" is an ordering, not a scan.
  sequence int not null,

  -- The day this session is expected on, in the client's own timezone. Advisory under
  -- 'sequential' (a missed session waits); authoritative under 'date_anchored'.
  scheduled_local_date date,
  label text,

  status text not null default 'prescribed'
    check (status in ('prescribed', 'in_progress', 'completed', 'scaled', 'skipped', 'superseded')),

  -- How a scaled session was reduced, and why. Repeated use is a life-stress signal, so
  -- it is recorded per session rather than inferred.
  scaling_mode text check (scaling_mode is null or scaling_mode in
    ('rough_shift', 'no_equipment', 'short_on_time')),
  scaling_reason text,

  workout_log_id uuid references workout_logs(id) on delete set null,
  completed_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, week_number, day_number)
);

create index if not exists idx_sessions_due
  on assignment_sessions (profile_id, status, sequence);
create index if not exists idx_sessions_date
  on assignment_sessions (profile_id, scheduled_local_date);

create table if not exists session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references assignment_sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null,

  -- 1 = keep under Short on Time, 2 = normal, 3 = first to drop.
  priority smallint not null default 2 check (priority between 1 and 3),

  -- Text, not numeric: the existing programs prescribe "6-10" and "AMRAP" as often as a
  -- plain number, and coercing that to an int would lose the prescription.
  prescribed_sets text,
  prescribed_reps text,
  rest text,

  percent_of_tm numeric,
  rpe_cap numeric,
  target_rpe text,
  unit text check (unit is null or unit in ('kg', 'lb')),
  lift_key text,
  coach_note text,

  -- Pre-chosen by the coach, so No Equipment does not have to guess at runtime.
  substitute_exercise_id uuid references exercises(id),
  -- The coach-authored Rough Shift variant. Null falls back to the scaling rule.
  scaled_sets text,
  scaled_reps text,

  created_at timestamptz not null default now(),
  unique (session_id, position)
);

create index if not exists idx_session_exercises_session on session_exercises (session_id, position);
create index if not exists idx_session_exercises_exercise on session_exercises (exercise_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table program_assignments enable row level security;
alter table assignment_sessions enable row level security;
alter table session_exercises enable row level security;

drop policy if exists assignments_select on program_assignments;
create policy assignments_select on program_assignments for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists sessions_select on assignment_sessions;
create policy sessions_select on assignment_sessions for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists session_exercises_select on session_exercises;
create policy session_exercises_select on session_exercises for select
  using (exists (
    select 1 from assignment_sessions s
    where s.id = session_exercises.session_id
      and (s.profile_id = auth.uid() or is_coach(auth.uid()))
  ));

grant select on program_assignments, assignment_sessions, session_exercises to authenticated;
-- Writes are server-side only, through the service-role client.

-- ── materialization ─────────────────────────────────────────────────────────

create or replace function materialize_assignment_sessions(p_assignment_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  prog record;
  built int := 0;
begin
  select * into a from program_assignments where id = p_assignment_id;
  if not found then
    raise exception 'No such assignment: %', p_assignment_id;
  end if;

  select * into prog from programs where id = a.program_id;
  if not found then
    raise exception 'Assignment % references a missing program', p_assignment_id;
  end if;

  -- Only unstarted sessions are rebuilt. A session that was completed, scaled or
  -- skipped is a record of something that actually happened to a person, and a program
  -- edit must never rewrite it — that would retroactively corrupt adherence.
  delete from assignment_sessions
  where assignment_id = a.id
    and status = 'prescribed'
    and workout_log_id is null;

  with flat as (
    select
      (w.value->>'week')::int                         as week_number,
      coalesce((d.value->>'day')::int, d.ordinality::int) as day_number,
      d.value->>'label'                               as label,
      row_number() over (order by w.ordinality, d.ordinality)::int as seq,
      d.value->'exercises'                            as exercises
    from jsonb_array_elements(prog.structure->'weeks') with ordinality as w,
         jsonb_array_elements(w.value->'days')        with ordinality as d
  ),
  inserted as (
    insert into assignment_sessions (
      assignment_id, profile_id, week_number, day_number, sequence,
      scheduled_local_date, label, status
    )
    select
      a.id, a.profile_id, f.week_number, f.day_number, f.seq,
      -- Each week is offset by seven days from the start, and days land in order within
      -- it. Advisory under 'sequential'; the schedule under 'date_anchored'.
      a.starts_on + ((f.week_number - 1) * 7) + (f.day_number - 1),
      f.label,
      'prescribed'
    from flat f
    on conflict (assignment_id, week_number, day_number) do nothing
    returning id, week_number, day_number
  )
  insert into session_exercises (
    session_id, exercise_id, position, prescribed_sets, prescribed_reps, rest,
    percent_of_tm, rpe_cap, target_rpe, unit, lift_key, coach_note
  )
  select
    i.id,
    e.id,
    ex.ordinality::int,
    ex.value->>'sets',
    ex.value->>'reps',
    ex.value->>'rest',
    nullif(ex.value->>'percentOfTm', '')::numeric,
    nullif(ex.value->>'rpeCap', '')::numeric,
    ex.value->>'targetRpe',
    case when ex.value->>'unit' in ('kg','lb') then ex.value->>'unit' else null end,
    ex.value->>'liftKey',
    ex.value->>'notes'
  from inserted i
  join flat f on f.week_number = i.week_number and f.day_number = i.day_number
  cross join lateral jsonb_array_elements(f.exercises) with ordinality as ex
  join exercises e on e.id::text = ex.value->>'exerciseId'
  on conflict (session_id, position) do nothing;

  select count(*) into built from assignment_sessions where assignment_id = a.id;

  update program_assignments
  set materialized_at = now(),
      source_updated_at = prog.updated_at,
      updated_at = now()
  where id = a.id;

  return built;
end;
$$;

revoke execute on function materialize_assignment_sessions(uuid) from public, anon, authenticated;

comment on function materialize_assignment_sessions(uuid) is
  'Rebuilds the unstarted sessions of an assignment from its program. Never touches a session that was completed, scaled or skipped. Re-runnable after a program edit.';

-- ── daily maintenance ───────────────────────────────────────────────────────
-- Without a sweep, the prescribed/skipped split is a snapshot that goes stale overnight
-- and a peaking block starts queuing work it can no longer fit before the meet. Called
-- from the daily cron. Sequential assignments are untouched — there a missed session
-- waits, and marking it skipped would both lose the work and misreport adherence.

create or replace function mark_missed_sessions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update assignment_sessions s
  set status = 'skipped', updated_at = now()
  from program_assignments a
  where a.id = s.assignment_id
    and a.status = 'active'
    and a.schedule_mode = 'date_anchored'
    and s.status = 'prescribed'
    and s.workout_log_id is null
    -- In the client's own timezone: a session is not missed until the day is actually
    -- over where the client lives.
    and s.scheduled_local_date < (now() at time zone a.timezone)::date;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function mark_missed_sessions() from public, anon, authenticated;

comment on function mark_missed_sessions() is
  'Daily. Marks past-due sessions on date-anchored assignments as skipped, in the client timezone. Sequential assignments are untouched — there a missed session waits.';
