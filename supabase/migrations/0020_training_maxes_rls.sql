-- New (not a reconstruction): training_maxes has had RLS enabled with zero
-- policies since it was created, so no RLS-bound (request-scoped) client can read
-- or write it at all — today it's only reachable via the service-role client from
-- the coach-only /api/training-maxes route. This adds the same profile_id-scoped
-- policy pattern used by every sibling table, as defense-in-depth. Purely
-- additive: does not change or remove the existing admin-client access path, only
-- widens who *could* access it under RLS.
drop policy if exists training_maxes_select on training_maxes;
create policy training_maxes_select on training_maxes for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists training_maxes_insert on training_maxes;
create policy training_maxes_insert on training_maxes for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists training_maxes_update on training_maxes;
create policy training_maxes_update on training_maxes for update
  using (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists training_maxes_delete on training_maxes;
create policy training_maxes_delete on training_maxes for delete
  using (is_coach(auth.uid()));

grant select, insert, update, delete on training_maxes to authenticated;
