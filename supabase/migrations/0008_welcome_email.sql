-- Tracks whether the tier-based welcome email has gone out for a profile, so
-- signup / Stripe webhook / first-login triggers don't send it more than once.
alter table profiles add column if not exists welcome_email_sent_at timestamptz;
