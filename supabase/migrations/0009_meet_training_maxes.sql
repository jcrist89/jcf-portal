-- Meet-prep training maxes: extends training_maxes to support a separate,
-- coach-approved TM track (kg, 90%-of-1RM) for competition lifts, kept apart
-- from the existing lb-based hit/miss auto-progression via a distinct
-- lift-key namespace (meet_bench / meet_deadlift vs bench / deadlift).

alter table training_maxes add column if not exists one_rm numeric;
alter table training_maxes add column if not exists unit text not null default 'lb' check (unit in ('lb','kg'));
alter table training_maxes add column if not exists tm_percent numeric;
alter table training_maxes add column if not exists updated_by uuid references profiles(id);

create unique index if not exists training_maxes_profile_lift_uidx on training_maxes(profile_id, lift);
