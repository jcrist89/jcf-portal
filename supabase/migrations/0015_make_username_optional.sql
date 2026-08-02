-- Reconstructs a migration applied directly to production on 2026-07-26 (live
-- version 20260726032130, name "make_username_optional"). No-op against
-- production; documents reality for a fresh environment.
--
-- Real Supabase Auth (email+password) replaced the old username+PIN scheme, so
-- username is no longer collected at signup. The column is kept (production still
-- has it, unused by current app code) rather than dropped — only the NOT NULL
-- requirement is lifted here, ahead of dropping pin_hash in the next migration.
alter table profiles alter column username drop not null;
