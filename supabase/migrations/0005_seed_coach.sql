-- Seeds Jon's coach account so there's a way to log in on day one.
-- Default login: username "jon", PIN "194756".
-- CHANGE THIS PIN IMMEDIATELY after your first login via Settings > Change PIN.
create extension if not exists pgcrypto;

insert into profiles (role, username, pin_hash, full_name, onboarded, is_active)
values (
  'coach',
  'jon',
  crypt('194756', gen_salt('bf')),
  'Jon Crist',
  true,
  true
)
on conflict (username) do nothing;
