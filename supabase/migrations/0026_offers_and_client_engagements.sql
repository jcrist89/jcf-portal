-- Offers and client engagements: the first foundation piece of the revamp.
--
-- Until now the only record of a commercial relationship was profiles.tier — a single
-- enum with no start date, no end date, no term, no price, and no way to tell a comped
-- client from a broken Stripe sync. Everything the coaching business needs to know
-- ("week 6 of 12", when does this renew, what did this person actually agree to pay,
-- is this arrangement complimentary or is billing broken) was unanswerable.
--
-- Two tables:
--
--   offers               What is for sale, versioned. The single source of every price
--                        string in the app — pricing page, signup, billing, emails and
--                        coach screens all read from here instead of hardcoding.
--
--   client_engagements   One person's actual arrangement, with the commercial terms
--                        SNAPSHOTTED at the moment they agreed. Raising a price later
--                        must never rewrite what an existing client signed up for, so
--                        these columns are copied from the offer, not joined to it.
--
-- profiles.tier is deliberately left alone for now. Retiring it touches four RLS
-- policies and every tier-gated screen; that is its own change, and this one is purely
-- additive so nothing in the running app shifts underneath a client.

-- ── offers ──────────────────────────────────────────────────────────────────

create table if not exists offers (
  code text primary key,
  version int not null default 1,
  name text not null,
  description text,

  -- Null amount means the price is not fixed here: an arrangement invoiced outside the
  -- app, or a complimentary one. The engagement still records what was actually agreed.
  amount_cents int check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'USD',
  cadence text not null check (cadence in ('one_time', 'monthly', 'weekly', 'none')),
  installments int check (installments is null or installments > 0),

  -- Null engagement_weeks means open-ended (a comp arrangement, or one bound to an
  -- event date rather than a fixed term — see client_engagements.ends_on).
  engagement_weeks int check (engagement_weeks is null or engagement_weeks > 0),
  minimum_weeks int check (minimum_weeks is null or minimum_weeks > 0),

  stripe_product_id text,
  stripe_price_id text,

  -- What this offer grants. Read through domain/engagement.ts, never inspected inline.
  entitlements jsonb not null default '{}'::jsonb,

  -- False keeps an offer out of the front door while still letting an engagement point
  -- at it — renewal-only rates, and the internal codes for non-standard arrangements.
  is_available_at_signup boolean not null default false,

  cancel_policy text not null default 'end_of_paid_period'
    check (cancel_policy in ('end_of_paid_period', 'immediate', 'no_cancel')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table offers is
  'What is for sale. The only place a price is written down — no UI file hardcodes one.';
comment on column offers.is_available_at_signup is
  'False = reachable only through renewal or a coach-created engagement, never the public signup flow.';

-- ── client_engagements ──────────────────────────────────────────────────────

create table if not exists client_engagements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,

  offer_code text not null references offers(code),
  offer_version int not null,

  -- Snapshot of the agreed terms. Copied from the offer at creation and never
  -- refreshed: this is the contract, and it has to stay historically accurate.
  agreed_amount_cents int check (agreed_amount_cents is null or agreed_amount_cents >= 0),
  currency text,
  cadence text,
  engagement_weeks int,

  starts_on date not null,
  -- The authority on when this ends. Null = open-ended. Not derived from
  -- engagement_weeks, because an engagement can be bound to an event (a meet) rather
  -- than to a term, and then the date is the real fact and the week count is the
  -- approximation.
  ends_on date check (ends_on is null or ends_on >= starts_on),

  -- 0 = Sunday, matching Postgres extract(dow).
  checkin_weekday smallint not null default 0 check (checkin_weekday between 0 and 6),

  -- Hour at which this client's training day starts. 4am by default so a night shift
  -- finishing at 01:30 counts toward the day the client believes he trained.
  day_boundary_hour smallint not null default 4 check (day_boundary_hour between 0 and 12),

  -- Where the money comes from. Distinguishing these is what lets the nightly billing
  -- check tell a legitimately comped client from a Stripe sync that has broken.
  billing_kind text not null check (billing_kind in
    ('stripe_subscription', 'stripe_payment', 'manual_invoice', 'complimentary')),

  -- Why this number is not the list price.
  rate_kind text not null default 'standard'
    check (rate_kind in ('standard', 'grandfathered', 'founding', 'comp')),

  status text not null default 'active' check (status in
    ('pending', 'active', 'past_due', 'canceled', 'completed', 'renewed')),

  -- Meet prep is a mode of an engagement, not a property of the app.
  mode text not null default 'general' check (mode in ('general', 'meet_prep')),

  stripe_customer_id text,
  stripe_subscription_id text,
  renewed_from_engagement_id uuid references client_engagements(id) on delete set null,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A client has at most one engagement actually running at a time. Renewals create a
-- new row and mark the previous one 'renewed'; history is never overwritten.
create unique index if not exists one_live_engagement_per_client
  on client_engagements (profile_id)
  where status in ('pending', 'active', 'past_due');

create index if not exists idx_engagements_profile on client_engagements(profile_id, starts_on desc);
create index if not exists idx_engagements_ends_on on client_engagements(ends_on)
  where status = 'active';

comment on column client_engagements.ends_on is
  'Authoritative end date. Null = open-ended. Not derived from engagement_weeks — an engagement bound to an event date has a real date and only an approximate week count.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Offers are readable by anyone (the pricing page is public and unauthenticated);
-- only the service role writes them. Engagements are private to the client and coach,
-- and are written server-side only — never directly by a browser.

alter table offers enable row level security;
alter table client_engagements enable row level security;

drop policy if exists offers_select on offers;
create policy offers_select on offers for select using (true);

drop policy if exists engagements_select on client_engagements;
create policy engagements_select on client_engagements for select
  using (profile_id = auth.uid() or is_coach(auth.uid()));

grant select on offers to authenticated, anon;
grant select on client_engagements to authenticated;
-- No insert/update/delete grants: every write goes through the service-role client
-- from a server route (checkout webhook, coach action), which bypasses RLS entirely.

-- ── seed offers ─────────────────────────────────────────────────────────────
-- The four commercial rows are the decided price ladder: paid-in-full is the cheapest
-- per week and weekly is the most expensive, so commitment is rewarded rather than
-- penalised. The two internal codes exist so every engagement points at something and
-- reporting stays uniform, without pretending a comped client bought a product.
--
-- NOTE: currency is seeded USD. Change it here before the first real checkout if these
-- are CAD prices — after that, existing engagements keep their own snapshot anyway.

insert into offers (code, version, name, description, amount_cents, currency, cadence,
                    installments, engagement_weeks, minimum_weeks, entitlements,
                    is_available_at_signup, cancel_policy)
values
  ('JCF_COACHING_12W_PIF', 1, 'Coaching — Paid in Full',
   '12-week coaching engagement, paid up front.',
   99700, 'USD', 'one_time', null, 12, 12,
   '{"coaching": true, "messaging": true, "checkins": true}'::jsonb, true, 'no_cancel'),

  ('JCF_COACHING_12W_3PAY', 1, 'Coaching — 3 Payments',
   '12-week coaching engagement, three monthly payments.',
   35000, 'USD', 'monthly', 3, 12, 12,
   '{"coaching": true, "messaging": true, "checkins": true}'::jsonb, true, 'end_of_paid_period'),

  ('JCF_COACHING_WEEKLY', 1, 'Coaching — Weekly',
   'Coaching billed weekly, 12-week minimum.',
   9700, 'USD', 'weekly', null, 12, 12,
   '{"coaching": true, "messaging": true, "checkins": true}'::jsonb, true, 'end_of_paid_period'),

  ('JCF_COACHING_RENEWAL_WEEKLY', 1, 'Coaching — Continuation',
   'Weekly continuation rate. Available only to a client finishing an engagement.',
   7500, 'USD', 'weekly', null, null, null,
   '{"coaching": true, "messaging": true, "checkins": true}'::jsonb, false, 'end_of_paid_period'),

  ('JCF_COACHING_EXTERNAL', 1, 'Coaching — Invoiced Outside the App',
   'Full coaching for a client billed directly rather than through Stripe.',
   null, 'USD', 'none', null, null, null,
   '{"coaching": true, "messaging": true, "checkins": true}'::jsonb, false, 'no_cancel'),

  ('JCF_COMP_FEEDBACK', 1, 'Complimentary — Feedback Partner',
   'Full access, no charge, in exchange for product feedback.',
   0, 'USD', 'none', null, null, null,
   '{"coaching": true, "messaging": true, "checkins": true}'::jsonb, false, 'no_cancel')
on conflict (code) do nothing;
