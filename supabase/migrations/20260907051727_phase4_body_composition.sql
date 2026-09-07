-- Phase 4: neck circumference supports sex-specific U.S. Navy body-fat estimates.
-- Measurements remain client-owned; the existing measurements RLS policies apply.
alter table public.measurements
  add column if not exists neck numeric;

comment on column public.measurements.neck is
  'Neck circumference in inches, used only for the optional U.S. Navy body-fat estimate.';
