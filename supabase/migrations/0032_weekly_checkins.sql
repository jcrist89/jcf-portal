-- The weekly check-in.
--
-- The artifact the entire coaching loop hangs from, and in six weeks of production the
-- measurements table it stood in for has been used three times. So the design optimises
-- for two things: making it obvious when one is owed, and making the COACH's half of the
-- exchange measurable. Knowing a check-in exists is worthless; knowing nobody has
-- answered it is what the retention queue needs.
--
-- Status is not a column. It derives from the timestamps below plus today's date — a
-- stored status is a state machine that can disagree with its own timestamps, and there
-- is no third party to arbitrate. Due dates are derived too, from the engagement's
-- checkin_weekday, rather than materialized like sessions: a check-in that was never
-- submitted has no row, and "overdue" is exactly the case that has to be answerable
-- without one.

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  engagement_id uuid references client_engagements(id) on delete set null,

  due_local_date date not null,

  opened_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  coach_responded_at timestamptz,

  weight numeric,
  waist numeric,
  sleep_avg numeric,
  night_shifts int,
  steps_avg int,
  nutrition_adherence int check (nutrition_adherence is null or nutrition_adherence between 1 and 10),
  protein_days int check (protein_days is null or protein_days between 0 and 7),
  alcohol_drinks int check (alcohol_drinks is null or alcohol_drinks >= 0),
  energy int check (energy is null or energy between 1 and 10),
  stress int check (stress is null or stress between 1 and 10),

  win text,
  struggle text,
  ask text,

  coach_response text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One per client per week. Also makes submission idempotent: a retried submit from a
  -- bad connection updates the same row rather than creating a second one.
  unique (profile_id, due_local_date)
);

create index if not exists idx_checkins_profile on checkins (profile_id, due_local_date desc);
create index if not exists idx_checkins_awaiting on checkins (submitted_at)
  where submitted_at is not null and coach_responded_at is null;

comment on table checkins is
  'Weekly check-in. Status is derived from these timestamps, never stored — a stored status is a state machine that can disagree with its own timestamps.';

alter table checkins enable row level security;

drop policy if exists checkins_select on checkins;
create policy checkins_select on checkins for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists checkins_insert on checkins;
create policy checkins_insert on checkins for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));

-- A client may edit their own answers; only the coach writes the response fields, which
-- is enforced in the route rather than here (Postgres RLS cannot gate per-column).
drop policy if exists checkins_update on checkins;
create policy checkins_update on checkins for update
  using (profile_id = auth.uid() or is_coach(auth.uid()))
  with check (profile_id = auth.uid() or is_coach(auth.uid()));

grant select, insert, update on checkins to authenticated;
