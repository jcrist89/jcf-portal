-- What the coach has already dealt with.
--
-- Signals themselves are NOT stored. They are derived on read from data that already
-- exists — missed sessions, unanswered messages, adherence, engagement dates. Storing
-- them would need a generation job, and the moment that job is late the queue starts
-- lying: showing a problem that is fixed, or missing one that isn't. Deriving them
-- means the queue is always current, and the only thing worth persisting is the coach's
-- decision about one.
--
-- The fingerprint is what makes "resolved" safe. It identifies THIS instance of a
-- condition, so resolving "2 sessions missed" cannot mask "5 sessions missed" a week
-- later — the fingerprint changes, no suppression matches, and the signal returns. A
-- resolve that silenced a condition permanently would be actively dangerous.

create table if not exists coach_signal_actions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,

  signal_kind text not null,

  -- Short string identifying this instance of the condition (e.g. 'missed:2').
  fingerprint text not null,

  action text not null check (action in ('snoozed', 'resolved')),
  -- Set for a snooze; the signal reappears on this date.
  snoozed_until date,

  note text,
  acted_at timestamptz not null default now(),
  acted_by uuid references profiles(id),

  -- One standing decision per instance. Snoozing then resolving updates in place.
  unique (profile_id, signal_kind, fingerprint)
);

create index if not exists idx_signal_actions_profile on coach_signal_actions (profile_id);

comment on table coach_signal_actions is
  'Coach decisions about derived signals. Signals are computed on read, never stored — only what was done about them is.';
comment on column coach_signal_actions.fingerprint is
  'Identifies this instance of a condition, so resolving a mild version cannot mask a worse one later.';

alter table coach_signal_actions enable row level security;

-- Coach-only in both directions: a client has no business reading, or writing, the
-- triage notes kept about them.
drop policy if exists signal_actions_select on coach_signal_actions;
create policy signal_actions_select on coach_signal_actions for select
  using (is_coach(auth.uid()));

drop policy if exists signal_actions_insert on coach_signal_actions;
create policy signal_actions_insert on coach_signal_actions for insert
  with check (is_coach(auth.uid()));

drop policy if exists signal_actions_update on coach_signal_actions;
create policy signal_actions_update on coach_signal_actions for update
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

drop policy if exists signal_actions_delete on coach_signal_actions;
create policy signal_actions_delete on coach_signal_actions for delete
  using (is_coach(auth.uid()));

grant select, insert, update, delete on coach_signal_actions to authenticated;
