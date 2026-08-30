-- Daily habits — the Big 4.
--
-- One row per client per training day. The 3-of-4 rule is a generated column rather
-- than application logic, so the client screen and the coach dashboard cannot disagree
-- about whether a day counted: there is only one place it is decided, and it is the
-- database.
--
-- Keyed on (profile_id, local_date), which makes every write naturally idempotent. A
-- habit tap replayed from an offline outbox ten times produces the same row as tapping
-- once, so this needs no receipt table — unlike workout completion, which has effects
-- beyond a single row.
--
-- local_date is the client's TRAINING day, not the UTC calendar day: with the 4am
-- boundary in localDate.ts, a night shift finishing at 01:30 counts toward the day the
-- client believes he trained. Storing the resolved date rather than a timestamp means
-- the day a habit belongs to is decided once, at write time, in the client's own zone.

create table if not exists habit_days (
  profile_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,

  protein boolean not null default false,
  steps   boolean not null default false,
  water   boolean not null default false,
  sleep   boolean not null default false,

  -- The 80% Protocol: three of four is a successful day. Perfection is not the bar,
  -- because a bar that requires perfection is one a tired person stops trying to clear.
  succeeded boolean generated always as (
    (protein::int + steps::int + water::int + sleep::int) >= 3
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, local_date)
);

create index if not exists idx_habit_days_recent on habit_days (profile_id, local_date desc);

comment on table habit_days is
  'One row per client per training day. Primary key makes every write idempotent — a replayed offline tap is a no-op.';
comment on column habit_days.succeeded is
  'The 3-of-4 rule, decided in one place so client and coach cannot disagree.';

alter table habit_days enable row level security;

drop policy if exists habit_days_select on habit_days;
create policy habit_days_select on habit_days for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));

-- A client taps their own habits, so unlike sessions these are client-writable. The
-- generated column means they cannot fabricate a successful day without also claiming
-- the three habits it takes.
drop policy if exists habit_days_insert on habit_days;
create policy habit_days_insert on habit_days for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists habit_days_update on habit_days;
create policy habit_days_update on habit_days for update
  using (profile_id = auth.uid() or is_coach(auth.uid()))
  with check (profile_id = auth.uid() or is_coach(auth.uid()));

grant select, insert, update on habit_days to authenticated;
-- No delete: a day is corrected by untapping a habit, not by erasing the record of it.
