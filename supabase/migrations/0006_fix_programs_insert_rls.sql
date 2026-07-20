-- Onboarding needs a CLIENT to insert their own per-client program instance
-- (a copy of the shared template) when they pick a goal. The original
-- programs_write policy only allowed the coach to write at all, which blocked
-- that self-service insert. Split into insert/update/delete: insert is allowed
-- for the coach OR a client inserting a row that belongs to them
-- (client_id = auth.uid()); update/delete stay coach-only.

drop policy if exists programs_write on programs;

create policy programs_insert on programs for insert
  with check (is_coach(auth.uid()) or client_id = auth.uid());

create policy programs_update on programs for update
  using (is_coach(auth.uid()));

create policy programs_delete on programs for delete
  using (is_coach(auth.uid()));
