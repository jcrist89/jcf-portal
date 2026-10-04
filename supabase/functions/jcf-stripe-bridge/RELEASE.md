# Stripe bridge repair: review and release record

Status: implementation prepared; production release HELD. Verified October 3,
2026 (America/New_York). Owner: CTO/CIO; final release decision: Jon Crist.

## Verified baseline

- Canonical repository: `jcrist89/jcf-portal`, base commit
  `4af0c5db7ae18ed57781e4f4b6f50e75a40f37f4` on `main`. No Edge Function source
  existed under `supabase/functions` at that revision.
- The accessible **Payment security repair specification** chat
  (`6ac14f2a-12d8-83ea-a2f4-4b645b0a1b95`) has only the research-started handoff,
  no completed report or attachments. This record uses narrow direct verification.
- Supabase project `xdztfuocalvpdmmvsxaw`: active `jcf-stripe-bridge` v2,
  `verify_jwt=false`, artifact SHA-256
  `efd70e99e8cf09ead82f282888e1d1609986494f66fad25f228e8b7a2d0e3757`.
  Its source accepts a static query-string credential and parses unsigned JSON.
  It writes `jcf_checkout_purchases` and tracks `jcf_stripe_events`.
- Live Stripe endpoint `we_1UKsX0PdonTh59bb3HsC3QiR` is enabled for
  `checkout.session.completed` and `checkout.session.async_payment_succeeded`,
  points to this bridge, and has an old key query parameter. Secret values and
  the full credential-bearing URL are intentionally absent from this repository.
- Approved Payment Link metadata matches the five offer codes in `bridge.ts`.
  All five return through `/api/attribution/checkout?session=...`, which redirects
  to `jcf-after-checkout`. The Shift Reset link was inactive at inspection;
  the four other approved links were active. No offer status changed here.
- Active `jcf-after-checkout` v3, artifact SHA-256
  `c25f83622b8f60ab8bfcaa76f0ad8edbd7ec4a3f3fda03632c22c8f20b84fd30`,
  reads purchases by checkout session ID, requires `payment_status=paid`, and
  checks coaching purchase amount against `offers.amount_cents` before
  creating/linking clients, entitlements, and engagements. Source remains unchanged.
- Read-only schema inspection confirms primary keys on
  `jcf_checkout_purchases.checkout_session_id` and `jcf_stripe_events.event_id`;
  both tables have RLS enabled and no client policies. All columns written by
  this patch already exist. No migration is required.
- The separate Vercel webhook already authenticates raw-body signatures and
  uses the separate `stripe_events` table. Its installment scheduling and
  purchase `stripe_schedule_id` update remain unchanged.

Verification used deployed source, Stripe GET operations, and metadata-only SQL.
No webhook was invoked, no event replayed, and no customer record read or changed.
This is not a production acceptance test.

## Implementation and intended behavior

- Stripe SDK `constructEventAsync` authenticates the untouched `req.text()` body
  before parsing; signature age tolerance is 300 seconds. Missing, malformed,
  wrong-secret, altered-body, and expired signatures return 400 without creating
  an admin client or touching either table. Query parameters confer no authority.
- `JCF_STRIPE_BRIDGE_SIGNING_SECRET` is required. Missing configuration returns
  503. It must be the signing secret of the exact Stripe endpoint above, not
  the Vercel endpoint or CLI listener secret. No Stripe API key is needed.
- Admin credentials come only from `SUPABASE_URL` and the existing
  `SUPABASE_SECRET_KEYS.default` / `SUPABASE_SERVICE_ROLE_KEY` environment fallback.
- Preserve all five approved offers, customer normalization, purchase columns,
  paid-purchase persistence, event deduplication, and session-key upserts.
  Both accepted event types now require explicit `payment_status=paid`; the old
  delayed-success path could default absent status to paid. Unpaid and unapproved
  events are acknowledged without a purchase, so a later distinct paid event
  can proceed.
- Every persistence error returns 500. A purchase written before completion
  bookkeeping fails can be safely retried. Receipt inserts ignore duplicates;
  failure updates only target unprocessed events, preventing a late failure
  from downgrading a concurrent success. Errors returned/stored are generic.
- Purchase upserts omit downstream-owned activation, profile, engagement,
  operational-alert and installment-schedule fields. Concurrency converges on
  one purchase row; this is idempotent persistence, not an exactly-once worker
  claim or a cross-table transaction. No external side effects were added.
- Edge dependencies are pinned and locked separately from the app. The app's
  Stripe/Supabase dependencies are unchanged. App TypeScript excludes the Deno
  folder; the CI bridge job type-checks and tests it independently.
- `vercel.json` disables Git deployments only for
  `security/jcf-stripe-bridge-signatures`, allowing a draft PR without a preview
  deployment. Do not rename the branch without updating this guard first.
  Merging to `main` can still trigger the existing Vercel integration, so merge
  remains separately held along with the manual Edge Function release.

## Test evidence

Runtime: Deno 2.9.6; Node 24.18.0. Commands from the bridge directory:

```sh
deno task --frozen check
deno task --frozen test
deno lint
```

27 bridge tests pass. Tests use independent Web Crypto HMAC signatures and the
real Stripe verifier, plus the actual Supabase client/store against an in-memory
PostgREST transport. Test execution denies network, environment, filesystem read,
and filesystem write access. Initial package loading may fetch pinned dependencies.

Coverage includes both valid paid event types; missing/invalid/wrong/expired
signatures; raw-byte tampering; signed malformed payloads; missing configuration;
unpaid, no-payment-required and missing paid status; unapproved offers; unrelated
events; sequential and concurrent duplicates; two events for the same session;
downstream-field preservation; delayed payment; lookup/receipt/purchase/completion
failures and retries; a lost completion response; failed failure-bookkeeping;
and environment credential fallback.

Existing app validation from repository root: `npm test` passes 374 tests across
41 files; `npx tsc --noEmit` and `npm run lint` pass. No build or deployment was
performed. CI runs the existing app checks plus the isolated bridge checks.

Limit: the transport simulator is not a real Postgres/Edge Runtime acceptance
test. Live constraints were inspected read-only; staging acceptance below is
still required. Dependency installation also reported pre-existing application
advisories: the production-only npm audit reports Next.js critical and Nodemailer
high findings. Their packages/lockfile were not changed; route their remediation
separately rather than expanding this bridge patch.

## Deployment plan — not executed

1. Obtain CEO approval for the exact commit, release window, signing-secret
   configuration, controlled acceptance method, and containment/rollback actions.
   Require green CI and review of this plan first.
2. In an isolated non-production Supabase environment with the relevant existing
   schema, configure environment credentials and a test Stripe endpoint-specific
   signing secret. Do not connect it to production data or replay production
   events. Verify Deno dependency/runtime compatibility there.
3. Test valid signed completed and delayed events against the staged function;
   verify exactly one purchase per session, successful event completion, and
   unchanged onboarding-owned fields. Confirm missing/invalid signatures create
   no rows. Verify unpaid/unapproved cases and retry after a simulated persistence
   failure. With synthetic paid data, exercise the existing after-checkout flow
   in the same isolated environment, including the offer-amount gate.
4. Before production release, securely obtain the signing secret for
   `we_1UKsX0PdonTh59bb3HsC3QiR` and configure
   `JCF_STRIPE_BRIDGE_SIGNING_SECRET` through Supabase secret management. Never
   place secret values in CLI arguments, logs, a PR, or source. Verify the
   project reference and keep built-in admin credentials unchanged.
5. Recheck that the two deployed function versions, endpoint destination and
   database contract have not changed since this record. Do not overwrite newer
   work. Record the approved source commit and operator in the release record.
6. Deploy only `jcf-stripe-bridge` from the approved commit, using the existing
   project and its per-function `verify_jwt=false` configuration. Inspect the
   installed Supabase CLI help before choosing deployment flags. No schema push,
   Vercel deployment, after-checkout deployment, or bulk function deployment.
7. The old query parameter may remain temporarily: it is ignored and cannot
   bypass signature verification. After successful cutover, remove it from the
   Stripe URL under the separately approved endpoint change. Do not rotate or
   alter unrelated application credentials.
8. Monitor Stripe delivery status and sanitized function logs immediately. Use
   only the CEO-approved acceptance event/method; production replay is a write
   and remains prohibited until explicitly approved. Confirm purchase and event
   state and the existing onboarding result without creating an unintended
   client/account. Watch both accepted event types during the agreed window.
9. Record acceptance evidence, deployed version, release commit, and the next
   secure rollback baseline. Stop if signatures reject legitimate deliveries or
   processing returns repeated 5xx. Do not mark release complete without this.

## Rollback / containment — security must remain closed

**Never redeploy v2 or restore URL-key-only authentication.** Its hash above is
for forensic comparison, not an approved rollback target. A Vercel rollback does
not roll back this Supabase function.

- First release has no previous verified signature-enforcing baseline. If it
  fails, keep authentication mandatory and repair the configuration, or perform
  the separately approved containment step: replace only this function with a
  fail-closed handler returning 503 for every request and doing no database work:

  ```ts
  Deno.serve(() => new Response("Webhook temporarily unavailable", { status: 503 }));
  ```

- Keep the Stripe endpoint enabled during temporary 503 containment so Stripe
  can retry. Do not return 200 while discarding events. Alert the CEO that new
  purchase onboarding is delayed; track the delivery backlog and retry window.
  Prolonged outage or disabling Payment Links is a separate business decision.
- Restore only this reviewed signature-enforcing commit or a later verified
  secure revision. Revalidate raw-body authentication before resuming processing.
  Never add an unsigned fallback to make deliveries succeed.
- Do not delete purchases or reset event flags during rollback. Rows written
  before a bookkeeping failure are handled by the session upsert on retry.
  Replay/reconciliation after recovery needs separately approved event IDs and
  an operator record, because it can change production state.
- For subsequent releases, a rollback target must itself pass signature tests,
  use compatible environment secrets/schema, and preserve paid/offer checks.

## Release blockers and Command Center handoff

Current priority / Now: narrow bridge repair ready for code review; release held.
Next: CEO-scoped non-production acceptance and endpoint-secret readiness.
Later: approved production release, URL-key retirement, secure-baseline recording.

Decisions needed: approve exact release scope, timing, controlled production
acceptance and fail-closed containment. Alternative is holding production
unchanged, which leaves the existing forgery risk active. The recommended repair
closes that risk with no pricing, schema, or onboarding redesign; misconfigured
signing secrets can delay legitimate onboarding.

Blockers: staging/Edge acceptance not yet performed; endpoint-specific secret
not verified or configured; production acceptance method and CEO release approval
outstanding. This patch is not evidence that production has been secured.

Risk register delta: legacy URL credential is treated as exposed. It also
appeared in an inspection tool response during this task before redaction was
corrected; no copy is present in this repository. No credential rotation or
endpoint change was performed. The security boundary after release must depend
on Stripe signatures regardless of the legacy key's secrecy.

System registry delta: GitHub gains the bridge source, dependency lock, tests,
and release record; Supabase still runs v2 until separately approved deployment.
Roadmap: implementation complete, review/acceptance/release pending.
Backlog: separately triage existing app dependency advisories. KPI: 27 bridge
tests and 374 application tests pass; no production outcome claimed.

Targeted Drive searches did not identify an authoritative Executive State,
System Registry, Roadmap, or Command Center document. This section is a pending
handoff, not a replacement business source of truth. Link the PR into the existing
Command Center when its authoritative location is identified; no duplicate
business document was created.

## References

- [Stripe webhook verification](https://docs.stripe.com/webhooks/signature)
- [Stripe webhook retries and duplicate handling](https://docs.stripe.com/webhooks)
- [Supabase Stripe webhook example](https://supabase.com/docs/guides/functions/examples/stripe-webhooks)
- [Vercel branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration)
