-- Meet-prep phase 2: readiness check-ins, joker-set requests, and deviation
-- reports (weight logged above the prescribed limit without an approved joker).
-- Weekly compliance is computed on demand from these + workout_logs, not stored.

create table if not exists readiness_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  date date not null default current_date,
  sleep int not null check (sleep between 1 and 5),
  fatigue int not null check (fatigue between 1 and 5),
  soreness int not null check (soreness between 1 and 5),
  joint_pain int not null check (joint_pain between 1 and 5),
  stress int not null check (stress between 1 and 5),
  motivation int not null check (motivation between 1 and 5),
  nutrition int not null check (nutrition between 1 and 5),
  confidence int not null check (confidence between 1 and 5),
  score numeric not null,
  tier text not null check (tier in ('high','moderate','low','very_low')),
  created_at timestamptz not null default now(),
  unique (profile_id, date)
);

create table if not exists joker_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  program_id uuid references programs(id) on delete set null,
  week_number int not null,
  lift text not null check (lift in ('meet_bench','meet_deadlift')),
  top_single_weight numeric not null,
  top_single_rpe numeric not null,
  max_permitted_weight numeric not null,
  status text not null default 'pending' check (status in ('pending','approved','denied','completed','failed_compliance')),
  coach_response text,
  actual_weight numeric,
  actual_rpe numeric,
  technical_result text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id)
);

create table if not exists deviation_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  workout_log_id uuid references workout_logs(id) on delete cascade,
  exercise_name text not null,
  lift_key text,
  week_number int,
  prescribed_weight numeric,
  actual_weight numeric not null,
  reason text,
  actual_rpe numeric,
  pain_score int,
  technical_rating int,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_readiness_checkins_profile on readiness_checkins(profile_id, date desc);
create index if not exists idx_joker_requests_profile on joker_requests(profile_id, requested_at desc);
create index if not exists idx_deviation_reports_profile on deviation_reports(profile_id, created_at desc);

alter table readiness_checkins enable row level security;
alter table joker_requests enable row level security;
alter table deviation_reports enable row level security;

drop policy if exists readiness_checkins_select on readiness_checkins;
create policy readiness_checkins_select on readiness_checkins for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists readiness_checkins_insert on readiness_checkins;
create policy readiness_checkins_insert on readiness_checkins for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists readiness_checkins_update on readiness_checkins;
create policy readiness_checkins_update on readiness_checkins for update
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists readiness_checkins_delete on readiness_checkins;
create policy readiness_checkins_delete on readiness_checkins for delete
  using (is_coach(auth.uid()));

drop policy if exists joker_requests_select on joker_requests;
create policy joker_requests_select on joker_requests for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists joker_requests_insert on joker_requests;
create policy joker_requests_insert on joker_requests for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists joker_requests_update on joker_requests;
create policy joker_requests_update on joker_requests for update
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists joker_requests_delete on joker_requests;
create policy joker_requests_delete on joker_requests for delete
  using (is_coach(auth.uid()));

drop policy if exists deviation_reports_select on deviation_reports;
create policy deviation_reports_select on deviation_reports for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists deviation_reports_insert on deviation_reports;
create policy deviation_reports_insert on deviation_reports for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists deviation_reports_update on deviation_reports;
create policy deviation_reports_update on deviation_reports for update
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists deviation_reports_delete on deviation_reports;
create policy deviation_reports_delete on deviation_reports for delete
  using (is_coach(auth.uid()));

grant select, insert, update, delete on readiness_checkins to authenticated;
grant select, insert, update, delete on joker_requests to authenticated;
grant select, insert, update, delete on deviation_reports to authenticated;
