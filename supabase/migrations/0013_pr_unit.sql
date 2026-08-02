-- PRs on competition lifts (meet_bench / meet_deadlift) are logged in kg, but
-- the prs table had no unit column, so every PR was displayed as "lb" no
-- matter what unit it was actually entered in. Add the column, backfill
-- existing rows to "lb" (the prior implicit assumption), and default new
-- rows to "lb" unless the app says otherwise.
alter table prs
  add column if not exists unit text not null default 'lb' check (unit in ('kg', 'lb'));

update prs set unit = 'lb' where unit is null;
