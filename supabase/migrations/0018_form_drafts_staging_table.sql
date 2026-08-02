-- Reconstructs a migration applied directly to production on 2026-07-29 (live
-- version 20260729065334, name "form_drafts_staging_table"). No-op against
-- production; documents reality for a fresh environment.
--
-- Backs the local-first draft-autosave feature (useDraftSync hook, /api/drafts):
-- workout/measurement/PR forms save to localStorage immediately and sync here in
-- the background, with a server-fallback fetch if local storage is empty (e.g. a
-- client switches devices mid-entry).
create table if not exists form_drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  form_type text not null check (form_type in ('workout','measurement','pr')),
  draft_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, form_type, draft_key)
);

alter table form_drafts enable row level security;

drop policy if exists form_drafts_select on form_drafts;
create policy form_drafts_select on form_drafts for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists form_drafts_insert on form_drafts;
create policy form_drafts_insert on form_drafts for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists form_drafts_update on form_drafts;
create policy form_drafts_update on form_drafts for update
  using (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists form_drafts_delete on form_drafts;
create policy form_drafts_delete on form_drafts for delete
  using (profile_id = auth.uid() or is_coach(auth.uid()));

grant select, insert, update, delete on form_drafts to authenticated;
