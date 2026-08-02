-- Reconstructs a migration applied directly to production on 2026-07-26 (live
-- version 20260726030408, name "add_default_template_flag"). No-op against
-- production; documents reality for a fresh environment.
--
-- Distinguishes the one canonical seed template per goal (used to auto-assign a
-- program at signup/onboarding) from any other is_template=true rows a coach may
-- create later. The partial unique index guarantees at most one default template
-- per goal.
alter table programs add column if not exists is_default_template boolean not null default false;

create unique index if not exists one_default_template_per_goal
  on programs (goal)
  where is_template = true and is_default_template = true;

-- Backfill: mark the earliest-created template per goal (the original 0003 seeds)
-- as the default, so a fresh bootstrap has a working default per goal the same way
-- production already does. No-op if a default is already set for a goal.
update programs set is_default_template = true
where is_template = true and client_id is null and is_default_template = false
  and id in (
    select id from (
      select id, row_number() over (partition by goal order by created_at asc) as rn
      from programs where is_template = true and client_id is null
    ) ranked where rn = 1
  );
