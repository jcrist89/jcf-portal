-- JCF Portal - Row Level Security
-- Auth model: the app mints its own Supabase-compatible JWT (HS256, signed with the
-- project's JWT secret) after verifying a client's username+PIN against profiles.pin_hash.
-- The token's `sub` claim is the profile id, so auth.uid() below resolves to profile.id.

create or replace function is_coach(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = uid and role = 'coach' and is_active = true
  );
$$;

alter table profiles enable row level security;
alter table programs enable row level security;
alter table measurements enable row level security;
alter table prs enable row level security;
alter table workout_logs enable row level security;
alter table achievements enable row level security;
alter table coach_notes enable row level security;

-- profiles
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_coach(auth.uid()));

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = auth.uid() or is_coach(auth.uid()));

drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert
  with check (is_coach(auth.uid()));

drop policy if exists profiles_delete on profiles;
create policy profiles_delete on profiles for delete
  using (is_coach(auth.uid()));

-- programs (templates + per-client copies): all authenticated users can read,
-- only the coach can write. Clients need read access to see their assigned program.
drop policy if exists programs_select on programs;
create policy programs_select on programs for select
  using (auth.uid() is not null);

drop policy if exists programs_write on programs;
create policy programs_write on programs for all
  using (is_coach(auth.uid()))
  with check (is_coach(auth.uid()));

-- measurements
drop policy if exists measurements_select on measurements;
create policy measurements_select on measurements for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists measurements_insert on measurements;
create policy measurements_insert on measurements for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists measurements_update on measurements;
create policy measurements_update on measurements for update
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists measurements_delete on measurements;
create policy measurements_delete on measurements for delete
  using (is_coach(auth.uid()));

-- prs
drop policy if exists prs_select on prs;
create policy prs_select on prs for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists prs_insert on prs;
create policy prs_insert on prs for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists prs_update on prs;
create policy prs_update on prs for update
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists prs_delete on prs;
create policy prs_delete on prs for delete
  using (is_coach(auth.uid()));

-- workout_logs
drop policy if exists workout_logs_select on workout_logs;
create policy workout_logs_select on workout_logs for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists workout_logs_insert on workout_logs;
create policy workout_logs_insert on workout_logs for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists workout_logs_update on workout_logs;
create policy workout_logs_update on workout_logs for update
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists workout_logs_delete on workout_logs;
create policy workout_logs_delete on workout_logs for delete
  using (is_coach(auth.uid()));

-- achievements (written by server-side rules engine using the acting user's session;
-- coach can also manually award)
drop policy if exists achievements_select on achievements;
create policy achievements_select on achievements for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists achievements_insert on achievements;
create policy achievements_insert on achievements for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists achievements_delete on achievements;
create policy achievements_delete on achievements for delete
  using (is_coach(auth.uid()));

-- coach_notes: both sides of the thread can read; each can insert as themselves
drop policy if exists coach_notes_select on coach_notes;
create policy coach_notes_select on coach_notes for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));
drop policy if exists coach_notes_insert on coach_notes;
create policy coach_notes_insert on coach_notes for insert
  with check (
    (profile_id = auth.uid() and author = 'client')
    or (is_coach(auth.uid()) and author = 'coach')
  );
drop policy if exists coach_notes_update on coach_notes;
create policy coach_notes_update on coach_notes for update
  using (profile_id = auth.uid() or is_coach(auth.uid()));

-- Standard Supabase grants: RLS above does the real restricting.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on profiles, programs, measurements, prs, workout_logs, achievements, coach_notes to authenticated;
grant execute on function is_coach(uuid) to authenticated, anon;
