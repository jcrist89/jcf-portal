-- What we have already sent about a check-in.
--
-- The check-in has been used three times in six weeks, because nothing has ever
-- prompted anyone to fill one in. This table is what makes prompting safe to run daily.
--
-- It stores a FACT, not a derivation: a push left this system, at this time, about this
-- check-in. Which reminder is owed is derived on read in src/domain/checkin.ts, the same
-- way status and due dates are. This table only answers "have we already said that?" —
-- and it has to exist for exactly the case that has no checkins row at all, because the
-- client never submitted one.
--
-- The unique key is the whole mechanism. The cron runs every day and re-derives the same
-- overdue reminder every day; the insert is what stops it becoming a daily nag. Deleting
-- a row here re-arms that reminder, which is the intended way to re-send one.

create table if not exists checkin_reminders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,

  -- The check-in being reminded about, by its due date. Deliberately not a foreign key
  -- to checkins: the reminders that matter most are for check-ins with no row.
  due_local_date date not null,

  kind text not null check (kind in ('day_before', 'morning_of', 'overdue')),

  sent_at timestamptz not null default now(),

  -- Each reminder is said once per check-in.
  unique (profile_id, due_local_date, kind)
);

create index if not exists idx_checkin_reminders_profile
  on checkin_reminders (profile_id, due_local_date desc);

comment on table checkin_reminders is
  'One row per reminder actually sent. Records a fact, not a derivation — which reminder is owed is computed on read. Delete a row to re-arm that reminder.';

alter table checkin_reminders enable row level security;

-- Written only by the cron, which uses the service role and bypasses RLS. A client may
-- read what was sent to them (so the app can say "we reminded you on the 29th"); the
-- coach may read all of it. Nobody writes through the anon or authenticated roles.
drop policy if exists checkin_reminders_select on checkin_reminders;
create policy checkin_reminders_select on checkin_reminders for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));

grant select on checkin_reminders to authenticated;
