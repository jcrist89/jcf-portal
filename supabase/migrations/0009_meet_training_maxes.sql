-- Meet-prep training maxes: extends training_maxes to support a separate,
-- coach-approved TM track (kg, 90%-of-1RM) for competition lifts, kept apart
-- from the existing lb-based hit/miss auto-progression via a distinct
-- lift-key namespace (meet_bench / meet_deadlift vs bench / deadlift).

-- Base table: this migration was written assuming training_maxes already existed,
-- but no earlier migration ever creates it (it was set up out-of-band). Added here,
-- 2026-08, during a migration-sync audit, as a no-op-in-production IF NOT EXISTS
-- guard so a fresh bootstrap from this migration history doesn't fail on the ALTER
-- TABLE statements below. Does not change production (table already exists there).
create table if not exists training_maxes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  lift text not null,
  weight numeric not null,
  updated_at timestamptz not null default now()
);

alter table training_maxes add column if not exists one_rm numeric;
alter table training_maxes add column if not exists unit text not null default 'lb' check (unit in ('lb','kg'));
alter table training_maxes add column if not exists tm_percent numeric;
alter table training_maxes add column if not exists updated_by uuid references profiles(id);

create unique index if not exists training_maxes_profile_lift_uidx on training_maxes(profile_id, lift);
