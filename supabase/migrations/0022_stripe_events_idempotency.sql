-- New (not a reconstruction): Stripe delivers webhook events at-least-once, so a
-- retried delivery can run the same event twice. The current handlers happen to be
-- idempotent by construction (repeated profile updates are harmless, and the
-- welcome email has its own separate dedup lock), but that's accidental, not
-- guaranteed for future event types. This ledger lets the webhook handler skip an
-- event it's already processed, as an explicit backstop.
create table if not exists stripe_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table stripe_events enable row level security;

-- Server-only table (service-role client from the webhook handler); no
-- authenticated/anon access needed or granted.
