-- JCF Portal - Core schema
create extension if not exists pgcrypto;

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  goal text not null check (goal in ('strength_gain','fat_loss','hybrid','powerlifting')),
  name text not null,
  description text,
  structure jsonb not null default '{}'::jsonb, -- { weeks: [ { week: 1, days: [ { day: 1, label: 'Day 1', exercises: [ { name, sets, reps, rest, notes } ] } ] } ] }
  is_template boolean not null default true, -- true = shared template Jon edits; false = a client-specific copy
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null default 'client' check (role in ('coach','client')),
  username text not null unique,
  pin_hash text not null,
  full_name text,
  birthday date,
  height_in numeric, -- height stored in inches
  starting_weight numeric,
  current_weight numeric,
  goal text check (goal in ('strength_gain','fat_loss','hybrid','powerlifting')),
  program_id uuid references programs(id) on delete set null,
  is_active boolean not null default true,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table programs add column if not exists client_id uuid references profiles(id) on delete cascade;

create table if not exists measurements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  date date not null default current_date,
  weight numeric,
  waist numeric,
  chest numeric,
  hips numeric,
  arms numeric,
  thighs numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists prs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  lift text not null, -- squat | bench | deadlift | overhead_press | custom text
  weight numeric not null,
  reps integer not null default 1,
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  program_id uuid references programs(id) on delete set null,
  date date not null default current_date,
  day_label text,
  exercises_completed jsonb not null default '[]'::jsonb, -- [ { name, sets: [ { reps, weight, rpe } ], notes } ]
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null, -- e.g. streak_4_weeks, first_log, pr_hit, 10_workouts_logged, goal_milestone
  title text not null,
  description text,
  date_earned date not null default current_date,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists coach_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade, -- which client this thread belongs to
  author text not null check (author in ('coach','client')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_measurements_profile on measurements(profile_id, date desc);
create index if not exists idx_prs_profile on prs(profile_id, date desc);
create index if not exists idx_workout_logs_profile on workout_logs(profile_id, date desc);
create index if not exists idx_achievements_profile on achievements(profile_id);
create index if not exists idx_coach_notes_profile on coach_notes(profile_id, created_at desc);
create index if not exists idx_profiles_username on profiles(username);
