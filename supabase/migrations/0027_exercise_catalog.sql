-- Exercise catalog: stable identity for movements.
--
-- Exercise history is currently joined on the display name string
-- (workoutHistory.ts matches `e.name === exerciseName`). Renaming "Bench Press" to
-- "Competition Bench Press" in the program builder therefore disconnects every prior
-- performance, every inline "last time" hint, and every PR comparison for that lift —
-- silently, with no error and no way to notice until a client asks why their numbers
-- vanished.
--
-- This gives every movement a row with a stable id and a normalised slug. The display
-- name becomes editable without consequence: rename the row, the id doesn't move, and
-- history stays attached. 0028 threads that id through the program structures and
-- workout logs that already exist.
--
-- movement_pattern is deliberately left null rather than keyword-guessed across 132
-- rows. A half-classified catalog is worse than an unclassified one, because nothing
-- tells you which rows were inferred and which were checked. It gets populated when
-- the No Equipment substitution feature needs it, by a coach who knows the answer.

create or replace function slugify(txt text)
returns text
language sql
immutable
strict
as $$
  select trim(both '-' from lower(regexp_replace(txt, '[^a-zA-Z0-9]+', '-', 'g')));
$$;

comment on function slugify(text) is
  'Normalised, stable key for an exercise name. Em-dashes, slashes, parentheses and colons all collapse to single hyphens.';

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),

  -- The stable key. Derived from the name at creation and then left alone: renaming an
  -- exercise must not change its slug, or the identity it exists to provide is not stable.
  slug text not null unique,

  -- Free to change. This is what a client reads on the session screen.
  name text not null,

  -- Null until someone who knows sets it. Needed by No Equipment substitution, which
  -- has to preserve the pattern it is substituting for.
  movement_pattern text check (movement_pattern is null or movement_pattern in
    ('squat', 'hinge', 'push_horizontal', 'push_vertical', 'pull_horizontal',
     'pull_vertical', 'lunge', 'carry', 'core', 'conditioning', 'accessory')),

  default_unit text not null default 'lb' check (default_unit in ('kg', 'lb')),
  demo_url text,
  coach_cue text,

  -- Retired rather than deleted: an archived exercise still has to resolve for the
  -- history that references it.
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_exercises_name on exercises (lower(name));

comment on column exercises.slug is
  'Stable identity. Derived from the original name and never recomputed — renaming the exercise must not move it.';

alter table exercises enable row level security;

-- Readable by any signed-in user: a client needs the name and demo link for every
-- exercise in their program. Writes are coach/service-role only, via the admin client.
drop policy if exists exercises_select on exercises;
create policy exercises_select on exercises for select using (auth.uid() is not null);

grant select on exercises to authenticated;

-- ── backfill ────────────────────────────────────────────────────────────────
-- Every distinct name that appears in any program structure or any workout log. The
-- union covers logs whose exercise no longer appears in a live program, so no history
-- is left unresolvable. `unit is null` last in the ordering means an exercise logged in
-- kg anywhere keeps kg as its default rather than losing it to a null-unit sibling.

insert into exercises (slug, name, default_unit)
select distinct on (slugify(name))
  slugify(name),
  name,
  coalesce(unit, 'lb')
from (
  select ex->>'name' as name, ex->>'unit' as unit
  from programs pr,
       jsonb_array_elements(pr.structure->'weeks') w,
       jsonb_array_elements(w->'days') d,
       jsonb_array_elements(d->'exercises') ex
  union all
  select ex->>'name', ex->>'unit'
  from workout_logs wl,
       jsonb_array_elements(wl.exercises_completed) ex
) src
where name is not null
  and slugify(name) <> ''
order by slugify(name), (unit is null), name
on conflict (slug) do nothing;
