-- Push notifications: subscription storage + inactivity-nudge tracking.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_profile on push_subscriptions(profile_id);

alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select on push_subscriptions;
create policy push_subscriptions_select on push_subscriptions for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists push_subscriptions_insert on push_subscriptions;
create policy push_subscriptions_insert on push_subscriptions for insert
  with check (profile_id = auth.uid() or is_coach(auth.uid()));

drop policy if exists push_subscriptions_delete on push_subscriptions;
create policy push_subscriptions_delete on push_subscriptions for delete
  using (profile_id = auth.uid() or is_coach(auth.uid()));

grant select, insert, delete on push_subscriptions to authenticated;

-- Remembers the highest "quiet days" threshold (7 or 14) we've already sent an
-- inactivity nudge for, so the daily cron job doesn't re-notify every run.
-- Reset to null by that same job once the client logs something again.
alter table profiles add column if not exists last_nudge_threshold integer;
