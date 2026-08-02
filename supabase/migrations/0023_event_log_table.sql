-- New (not a reconstruction): operational monitoring. There is currently no
-- structured logging or error tracking anywhere in the app — failures in the
-- cron job, Stripe webhook, push notifications, and workout saves are either
-- silently swallowed or only visible in raw Vercel function logs. This table
-- gives the coach a queryable, in-app view without adding a paid external
-- service. Server-only writes (service-role client from route handlers/cron);
-- coach-only reads.
create table if not exists event_log (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'error' check (level in ('info', 'warning', 'error')),
  source text not null, -- e.g. 'cron.nudge', 'stripe.webhook', 'push.send', 'workouts.save'
  message text not null,
  context jsonb not null default '{}'::jsonb, -- structured, non-sensitive details only
  profile_id uuid references profiles(id) on delete set null, -- optional, when the event concerns one client
  created_at timestamptz not null default now()
);

create index if not exists idx_event_log_created_at on event_log(created_at desc);
create index if not exists idx_event_log_source on event_log(source, created_at desc);

alter table event_log enable row level security;

drop policy if exists event_log_select on event_log;
create policy event_log_select on event_log for select
  using (is_coach(auth.uid()));

grant select on event_log to authenticated;
-- No insert/update/delete grant to authenticated or anon — writes only happen
-- via the service-role client (which bypasses RLS/grants entirely) from server
-- code, never from a client-facing request.
