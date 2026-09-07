-- Phase 1: make onboarding authoritative for goals, training preferences, and
-- initial nutrition targets. Existing client-owned programs and logs are kept;
-- only the legacy goal labels are normalized.

alter table programs drop constraint if exists programs_goal_check;
alter table profiles drop constraint if exists profiles_goal_check;

update programs
set goal = case goal
  when 'strength_gain' then 'muscle_gain'
  when 'hybrid' then 'recomposition'
  when 'powerlifting' then 'strength'
  else goal
end
where goal in ('strength_gain', 'hybrid', 'powerlifting');

update profiles
set goal = case goal
  when 'strength_gain' then 'muscle_gain'
  when 'hybrid' then 'recomposition'
  when 'powerlifting' then 'strength'
  else goal
end
where goal in ('strength_gain', 'hybrid', 'powerlifting');

alter table programs
  add constraint programs_goal_check
  check (goal in ('fat_loss', 'recomposition', 'muscle_gain', 'strength'));

alter table profiles
  add constraint profiles_goal_check
  check (goal is null or goal in ('fat_loss', 'recomposition', 'muscle_gain', 'strength'));

update programs
set
  name = case goal
    when 'muscle_gain' then replace(name, 'Strength Gain', 'Muscle Gain')
    when 'recomposition' then replace(name, 'Hybrid', 'Recomposition')
    when 'strength' then replace(name, 'Powerlifting', 'Strength')
    else name
  end,
  description = case goal
    when 'muscle_gain' then 'Progressive resistance training focused on adding muscle and improving work capacity.'
    when 'recomposition' then 'Build muscle while steadily improving conditioning and body composition.'
    when 'strength' then 'Compound-lift training focused on measurable strength progression.'
    else description
  end,
  updated_at = now()
where is_template = true and is_default_template = true;

alter table profiles
  add column if not exists sex text
    check (sex is null or sex in ('female', 'male')),
  add column if not exists age integer
    check (age is null or age between 13 and 100),
  add column if not exists preferred_units text not null default 'imperial'
    check (preferred_units in ('imperial', 'metric')),
  add column if not exists experience_level text
    check (experience_level is null or experience_level in ('beginner', 'intermediate', 'advanced')),
  add column if not exists training_days integer
    check (training_days is null or training_days between 2 and 6),
  add column if not exists available_equipment text[] not null default '{}'::text[],
  add column if not exists dietary_preferences text[] not null default '{}'::text[],
  add column if not exists dietary_notes text,
  add column if not exists maintenance_calories integer
    check (maintenance_calories is null or maintenance_calories between 800 and 10000),
  add column if not exists target_calories integer
    check (target_calories is null or target_calories between 1800 and 10000),
  add column if not exists protein_grams integer
    check (protein_grams is null or protein_grams between 0 and 1000),
  add column if not exists carb_grams integer
    check (carb_grams is null or carb_grams between 0 and 1500),
  add column if not exists fat_grams integer
    check (fat_grams is null or fat_grams between 0 and 500);

comment on column profiles.maintenance_calories is
  'Initial JCF estimate: canonical bodyweight in pounds multiplied by 12.';
comment on column profiles.target_calories is
  'Fat loss starts 15 percent below the bodyweight x12 estimate, capped at a 500 calorie deficit. All goal targets have an 1800 calorie floor.';
comment on column profiles.protein_grams is
  '35 percent of target calories divided by 4 and rounded to whole grams.';
comment on column profiles.carb_grams is
  '40 percent of target calories divided by 4 and rounded to whole grams.';
comment on column profiles.fat_grams is
  '25 percent of target calories divided by 9 and rounded to whole grams.';
