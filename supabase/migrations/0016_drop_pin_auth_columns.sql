-- Reconstructs a migration applied directly to production on 2026-07-26 (live
-- version 20260726032152, name "drop_pin_auth_columns"). No-op against
-- production; documents reality for a fresh environment.
--
-- pin_hash was only ever used by the retired custom-JWT/PIN auth scheme (see
-- 0002_rls.sql's now-stale header comment describing it). Confirmed unused by any
-- app code since the Supabase Auth migration (0014); dropped from production
-- directly, reconstructed here for parity.
alter table profiles drop column if exists pin_hash;
