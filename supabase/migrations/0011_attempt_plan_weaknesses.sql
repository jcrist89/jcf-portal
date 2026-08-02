-- Meet-prep phase 3: competition attempt plan + weakness checklist, both stored
-- directly on the program row (kg, coach-editable, no new tables needed).
alter table programs add column if not exists attempt_plan jsonb;
alter table programs add column if not exists weaknesses jsonb;
