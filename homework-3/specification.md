# Specification — Recurring Donation Lifecycle

> **Feature scope:** the lifecycle of a *recurring* donation (monthly/annual pledge) within a larger nonprofit fundraising platform, backed by Stripe Billing.
> **Status:** specification only — no implementation.
> **Audience:** the engineering team and the AI coding agent that will build this feature. Read together with [`agents.md`](./agents.md) and the AI rules file.

---

## 1. High-Level Objective

**Platform context:** *GivePlatform* is a donation management platform (donor CRM + billing orchestration) for nonprofits. It is the system of record for **donors, funds/campaigns, and gifts**; **Stripe Billing** is the payment processor underneath. The platform's value over raw Stripe is that it owns the donor relationship, fund designations, tax receipting, and reconciliation — so two systems of record (our donor ledger and Stripe) must always agree. This feature owns the **recurring-pledge lifecycle** and is responsible for keeping the donor ledger in agreement with Stripe.

**North star:** Let a donor start, manage, and stop a recurring pledge with confidence that every charge is correct, every change takes effect predictably, and every event is auditable — while the nonprofit's ops/finance team can reconcile and intervene without ever touching raw card data.

**Scope boundary (one sentence):** This spec covers the *state and lifecycle* of an existing donor's recurring pledge — creation, pause/resume, amount change, cancellation, and automated dunning on failed renewals — and explicitly **excludes** donor identity/account onboarding, one-time donations, the payment-method capture UI, tax-receipt generation, and the GL/accounting export (these are adjacent features this one integrates with, not owns).

---

## 2. Mid-Level Objectives

Each objective is **observable** — phrased as what is verifiably different in the world when it succeeds. Every low-level task in §6 ties back to one of these IDs.

| ID | Objective | Observable success signal |
|----|-----------|---------------------------|
| **MO-1** | **Create a recurring pledge.** A donor with a saved payment method can establish a recurring donation (amount, currency, interval, optional designation/fund) that begins charging on a defined schedule. | A `pledge` record exists in `active` state, a matching Stripe Subscription exists, the first invoice is paid (or scheduled), and the donor sees the next charge date. |
| **MO-2** | **Pause and resume a pledge.** A donor or ops can temporarily suspend charges and later resume, without losing pledge history or designation. | Pledge moves `active → paused` (no charges occur while paused) and `paused → active` (charging resumes on the next cycle); both transitions are timestamped and attributed. |
| **MO-3** | **Change the pledge amount.** A donor can raise or lower their recurring amount, with the new amount applying from a clearly defined cycle — never silently mid-cycle. | The pledge's effective amount changes from a stated date; the *next* invoice reflects the new amount; the old amount is retained in history. |
| **MO-4** | **Cancel a pledge.** A donor or ops can end a recurring donation permanently, with no further charges, while the record is retained for audit and reporting. | Pledge reaches terminal `canceled` state; the Stripe Subscription is canceled immediately or scheduled for end-of-period cancellation (per mode); no invoices are created after the effective end date; the historical record remains queryable. |
| **MO-5** | **Recover failed renewals (dunning).** When a scheduled charge fails, the system retries on a defined schedule, notifies the donor, and escalates to a terminal state if recovery fails — without ever double-charging. | A failed renewal moves the pledge to `past_due`, triggers the retry schedule + donor notification, and resolves to either `active` (recovered) or `canceled`/`unpaid` (exhausted) — each step logged. |
| **MO-6** | **Reconcile donor and Stripe state.** Every externally-driven payment event (Stripe webhook) is ingested exactly once, applied in a consistent order, and any divergence between our records and Stripe is detectable. | For any pledge, our stored state provably matches Stripe's authoritative state (or a mismatch is flagged to ops); duplicate/out-of-order/replayed webhooks produce no incorrect state change. |
| **MO-7** | **Give ops/compliance an auditable view & controlled intervention.** Internal staff can inspect a pledge's full history and perform bounded actions (pause, cancel, issue refund request) under role-based access, with every action recorded. | An ops user can view the complete, immutable event timeline for a pledge and perform permitted actions; every internal action is attributed to a named actor in the audit log. |

**Traceability rule:** §6 low-level tasks are labeled `T-<MO>.<n>` (e.g. `T-1.3` serves MO-1). §7 edge cases, §8 verification, and §9 performance each reference the MO(s) they protect.

---

## 3. Non-Functional & Policy Requirements

Stated as **targets/ranges**, not adjectives. IDs (`NFR-*`) are referenced by tasks and verification.

### 3.1 Security & Privacy

| ID | Requirement |
|----|-------------|
| **NFR-SEC-1** | **No raw card data, ever.** The platform never receives, stores, logs, or transmits PAN/CVV/full card numbers. Payment methods are referenced only by Stripe token/`payment_method` ID. Card data capture happens client-side via Stripe Elements; our backend sees only opaque IDs. (PCI-DSS SAQ-A posture.) |
| **NFR-SEC-2** | **PII minimization & encryption.** Donor PII (name, email, address) is encrypted at rest (AES-256 or provider-managed KMS) and in transit (TLS 1.2+). Amounts and designations are not PII but are access-controlled. |
| **NFR-SEC-3** | **Least-privilege access.** All pledge mutations require an authenticated principal. Donors may act only on their own pledges; ops actions require explicit roles (see NFR-POL-3). Service-to-service calls use scoped credentials. |
| **NFR-SEC-4** | **Webhook authenticity.** Every inbound Stripe webhook signature is verified (`Stripe-Signature` + signing secret) before processing; unverified payloads are rejected and logged, never applied. |
| **NFR-SEC-5** | **Secrets management.** Stripe API keys and webhook secrets live in a secrets manager (not env files in VCS), rotated at least every 90 days. |

### 3.2 Audit & Logging

| ID | Requirement |
|----|-------------|
| **NFR-AUD-1** | **Append-only audit trail.** Every state transition and every human/automated action on a pledge writes an immutable audit event: `{event_id, pledge_id, actor (donor/ops-user/system), action, before_state, after_state, reason, source (ui/api/webhook/job), correlation_id, timestamp}`. Audit records are never updated or deleted. |
| **NFR-AUD-2** | **Attribution.** Every mutation is attributable to a named actor (donor ID, ops user ID, or named system job). "System" alone is insufficient — the job/webhook event ID must be captured. |
| **NFR-AUD-3** | **Retention.** Audit and financial-event records are retained **≥ 7 years** (typical nonprofit/financial recordkeeping requirement); donor PII follows data-retention/erasure policy but financial-transaction facts are retained in pseudonymized form even after erasure requests. |
| **NFR-AUD-4** | **Log hygiene.** Application logs must never contain PAN, CVV, full webhook payloads with card data, or Stripe secret keys. Structured logs carry `correlation_id` and `pledge_id` for traceability. |

### 3.3 Reliability & Consistency

| ID | Requirement |
|----|-------------|
| **NFR-REL-1** | **Exactly-once effect on webhooks.** Webhook processing is idempotent by Stripe `event.id`; a redelivered or duplicated event causes no second state change or second ledger entry. |
| **NFR-REL-2** | **Idempotent writes.** All money-adjacent operations (create pledge, change amount, cancel) accept a client-supplied idempotency key and are safe to retry; the platform also passes idempotency keys to Stripe. |
| **NFR-REL-3** | **Stripe is the source of truth for money; the platform is source of truth for intent.** On conflict, the platform reconciles toward Stripe for payment facts (was it charged?) but retains its own record of donor intent (what the donor asked for). Divergence is surfaced to ops, never silently overwritten. |
| **NFR-REL-4** | **Availability.** Donor-facing pledge read/write endpoints target **99.9%** monthly availability. Webhook ingestion targets **99.95%** (losing a payment event is worse than a donor briefly unable to load a page) and is backed by a durable queue so Stripe redelivery + our retry both apply. |
| **NFR-REL-5** | **Graceful degradation.** If Stripe is unreachable, donor-initiated mutations are queued or rejected with a clear retryable error — never silently accepted as if applied. Reads of last-known pledge state remain available. |

### 3.4 Policy & Compliance

| ID | Requirement |
|----|-------------|
| **NFR-POL-1** | **Refunds are intent-recorded, not auto-executed.** A donor cancellation stops future charges but does **not** auto-refund past donations; refund of a completed donation is an ops/finance action with its own approval and audit (refund *execution* is out of scope, but the refund-*request* hand-off is in scope). |
| **NFR-POL-2** | **Restricted-fund integrity.** A pledge's fund/designation cannot be silently changed; changing designation is a distinct, audited action (and out of scope for amount-change tasks — amount and designation are separate concerns). |
| **NFR-POL-3** | **Role-based ops actions.** Ops roles: `support` (view + pause/resume), `finance` (above + initiate refund request + cancel), `compliance` (read-all + audit export, no mutations). Role definitions are enforced server-side, not in the UI. |
| **NFR-POL-4** | **Donor consent & transparency.** The donor must see and confirm amount, interval, and next-charge date before a pledge is created or an amount change takes effect; mandate/consent is timestamped and audited (aligns with SCA/mandate expectations for recurring payments). |

---

## 4. Implementation Notes (Guardrails for Builders)

Conventions an implementer (human or agent) **must not violate**. These are normative.

### 4.1 Money

- **Store money as integer minor units** (cents) + ISO-4217 currency code. **Never** use floats for money. A `$25.00` monthly pledge is `{ amount: 2500, currency: "USD" }`.
- **Currency is fixed per pledge.** Changing currency = cancel + create new pledge, not an amount change (Stripe subscriptions don't change currency in place).
- **Display formatting is a presentation concern**; the API always returns minor units + currency, never a pre-formatted string.

### 4.2 Identifiers

- **Internal IDs are opaque, prefixed UUIDs**: `pledge_…`, `donor_…`, `fund_…`, `audit_…`. Never expose sequential integers (enumeration risk).
- **Store the Stripe mapping explicitly**: each pledge persists `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`. Never derive one from the other implicitly.
- **`correlation_id`** is generated at the edge of every request/webhook/job and threaded through all logs and audit events for that unit of work.

### 4.3 Idempotency

- **Inbound (donor/ops):** mutating endpoints require an `Idempotency-Key` header; the platform persists `{key → result}` and replays the stored result on retry within a 24h window.
- **Outbound (to Stripe):** every Stripe write passes a deterministic idempotency key derived from the operation + pledge + intent (e.g. `pledge_<id>:amount-change:<new_price_id>`), so our retries never create duplicate Stripe objects.
- **Webhooks:** dedupe on Stripe `event.id`; persist processed event IDs; processing is a no-op if already seen.

### 4.4 State Machine (canonical)

Pledge states and the **only** legal transitions:

```
Legal transitions (all others → 409 Conflict):

  pending  ──► active       first invoice paid (invoice.paid webhook)
  pending  ──► canceled     initial-charge grace window exhausted (terminal)
  active   ──► paused       suspended by donor or ops
  active   ──► past_due     renewal charge fails (invoice.payment_failed)
  active   ──► canceled     cancelled by donor or ops (terminal)
  paused   ──► active       resumed by donor or ops
  paused   ──► canceled     cancelled by donor or ops (terminal)
  past_due ──► active       dunning recovery: later invoice paid
  past_due ──► canceled     cancelled by donor or ops during dunning (terminal)
  past_due ──► unpaid       dunning cap exhausted (terminal)
```

- `pending`: created, first charge not yet confirmed; transitions to `active` on payment or to `canceled` when the configurable grace window (default: 24 h) expires without a successful payment.
- `active`: charging on schedule.
- `paused`: donor/ops suspended; no charges.
- `past_due`: a renewal failed; dunning in progress.
- `canceled`: ended by donor, ops, or grace-window expiry (terminal).
- `unpaid`: dunning exhausted without recovery (terminal).
- **Illegal transitions** (e.g. `canceled → active`, `paused → past_due`, `unpaid → active`) are rejected with a `409 Conflict` / domain error and audited as a rejected attempt.

### 4.5 Error Semantics

- **Map every failure to a stable taxonomy**, not raw Stripe/HTTP errors: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409, illegal transition / idempotency replay mismatch), `PAYMENT_FAILED` (402, card declined), `UPSTREAM_UNAVAILABLE` (503, Stripe down), `RATE_LIMITED` (429).
- **Errors are actionable & safe:** donor-facing messages never leak Stripe internals, card data, or stack traces; they state what happened and whether it's retryable.
- **Distinguish retryable from terminal:** `UPSTREAM_UNAVAILABLE` and `RATE_LIMITED` are retryable; `VALIDATION_ERROR` and `FORBIDDEN` are not. Retry policy uses exponential backoff with jitter.

### 4.6 Effective-Dating (no silent surprises)

- **Amount changes are always deferred to the next billing cycle** — no proration, never mid-cycle. The API response and donor confirmation always state the **effective date** and the **next charge amount**.
- **Cancellations support two explicit modes** (never inferred):
  - **At-period-end (default):** pledge moves to `canceled` in our system immediately upon request, storing `cancellation_mode: at_period_end` and `cancellation_effective_at = current_period_end`; Stripe is told `cancel_at_period_end=true` — the Stripe subscription remains in `active` status on Stripe's side until the period ends, when Stripe fires `customer.subscription.deleted`; no new invoices are generated after `cancellation_effective_at`; donor retains access through the period already paid. Response states `cancellation_effective_at`.
  - **Immediate:** pledge moves to `canceled` immediately; Stripe subscription is canceled now (`cancel_at_period_end=false`); no refund of the current period (see NFR-POL-1). Response states the cancellation timestamp.
- **History is immutable:** changing an amount creates a new effective record; the prior amount/interval remains queryable with its valid-from/valid-to range.

---

## 5. Context

What the agent can assume **exists before** work starts, and what must **exist after**. Hypothetical but specific — no ambiguity about the workspace.

### 5.1 Beginning Context (given — do not build)

**Adjacent platform features already in place:**

| Asset | Shape / contract this feature relies on |
|-------|------------------------------------------|
| **Donor record** | `donor_<uuid>` exists with verified identity, email, and `stripe_customer_id`. Onboarding is out of scope; a pledge always attaches to an existing donor. |
| **Saved payment method** | The donor has ≥1 Stripe `payment_method` attached to their Customer, captured client-side via Stripe Elements. Backend holds only the `pm_…` ID. Capture UI is out of scope. |
| **Fund / Campaign catalog** | `fund_<uuid>` records exist (name, restricted/unrestricted flag, active status). A pledge references a fund; managing the catalog is out of scope. |
| **Stripe account & Billing** | A configured Stripe account with Billing enabled, API keys + webhook signing secret in the secrets manager, and a webhook endpoint registered. Stripe `Product`/`Price` objects for recurring intervals exist or are created on demand. |
| **Auth / identity service** | Issues authenticated principals for donors (donor portal session) and ops users (with roles `support`/`finance`/`compliance`). This feature consumes identity; it does not implement login. |
| **Audit log store** | An append-only event store (write API) exists; this feature writes to it per NFR-AUD-1. |
| **Notification service** | A transactional email/SMS sender exists (`notify(donor_id, template, params)`); templates for receipts exist. This feature triggers notifications; it does not own delivery. |
| **Donor ledger / gift history** | The CRM-side store of recorded gifts per donor. This feature appends pledge-driven gift records; reporting/analytics consume it downstream. |

**Data stores assumed available:** a transactional relational DB (Postgres-class) for pledge state + idempotency keys + Stripe-ID mapping; a durable queue (SQS/PubSub-class) for webhook ingestion; the append-only audit store.

**Pre-conditions for any task:** the donor is authenticated (or an authorized ops user is acting), the referenced fund is active, and at least one valid payment method exists.

### 5.2 Ending Context (must exist after the feature is built)

**New persistent artifacts owned by this feature:**

| Artifact | Description |
|----------|-------------|
| **`pledge` table** | Pledge aggregate root: `pledge_id`, `donor_id`, `fund_id`, `amount_minor`, `currency`, `interval`, `state`, `stripe_subscription_id`, `stripe_price_id`, `current_period_end`, `created_at`, timestamps for each transition. |
| **`pledge_amount_history` table** | Effective-dated amount/interval records (valid-from / valid-to) per §4.6, so prior amounts stay queryable. |
| **`idempotency_key` store** | `{key, scope, request_fingerprint, result, expires_at}` for inbound replay protection (§4.3). |
| **`processed_webhook_event` store** | Set of handled Stripe `event.id`s for exactly-once webhook effect (NFR-REL-1). |
| **`dunning_attempt` records** | Per-pledge retry attempts: attempt number, scheduled-at, outcome, next-action — backing MO-5. |
| **Audit events** | One immutable event per transition/action in the existing audit store (NFR-AUD-1). |

**New behaviors/services that exist after:**
- A **pledge lifecycle API** (create / pause / resume / change-amount / cancel / get / list) consumed by donor portal and ops console.
- A **webhook ingestion handler** (verify → enqueue → dedupe → apply → audit) for the subscribed Stripe events (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, etc.).
- A **dunning worker** that advances `past_due` pledges through the retry schedule and resolves them.
- A **reconciliation job** that periodically compares platform pledge state against Stripe and emits mismatches to an ops queue (MO-6).
- An **ops query/intervention surface** (read timeline + permitted actions, RBAC-enforced) (MO-7).

**End-state invariant:** for every non-terminal pledge, platform state and Stripe subscription state agree, or a reconciliation flag exists explaining the divergence. No pledge is ever in an undefined state outside §4.4.

---

## 6. Low-Level Tasks

Each task is an executable slice with a **Definition of Done (DoD)** an implementer can check off. Tasks are labeled `T-<MO>.<n>` and trace to the mid-level objective they serve. `T-0.*` are shared foundations every other task depends on.

### T-0 — Foundations (cross-cutting; prerequisites)

**T-0.1 — Pledge data model & migrations** *(serves all MOs)*
Create `pledge`, `pledge_amount_history`, `dunning_attempt` tables per §5.2 with the §4.4 state column constrained to the enum.
- **DoD:** migrations run forward/back cleanly; `state` column rejects values outside the enum at the DB level; `pledge` row stores all Stripe-mapping IDs (§4.2); money stored as `amount_minor` integer + `currency`.

**T-0.2 — Idempotency middleware (inbound)** *(serves MO-1,3,4)*
Implement `Idempotency-Key` capture, fingerprint of request body, `{key→result}` persistence with 24h TTL, and stored-result replay.
- **DoD:** replaying an identical request within 24h returns the original result without re-executing side effects; same key + different body → `409 CONFLICT`; key absent on a mutating endpoint → `400 VALIDATION_ERROR`.

**T-0.3 — Outbound Stripe client wrapper** *(serves MO-1,2,3,4,5)*
Wrap the Stripe SDK so every write passes a deterministic idempotency key (§4.3) and every error maps to the §4.5 taxonomy with retryable/terminal classification + exponential-backoff-with-jitter.
- **DoD:** a forced duplicate call to create a subscription produces exactly one Stripe object; injected 500/timeout retries per policy; declined card surfaces as `PAYMENT_FAILED`, Stripe outage as `UPSTREAM_UNAVAILABLE`.

**T-0.4 — Audit event emitter** *(serves all MOs; enforces NFR-AUD-1/2)*
Provide `emitAudit({pledge_id, actor, action, before, after, reason, source, correlation_id})` writing to the append-only store.
- **DoD:** every state transition in the codebase routes through this emitter; emitted events carry a non-null named actor and correlation_id; attempting to update/delete an audit row is rejected. Verified by the §8 audit-coverage test.

**T-0.5 — Correlation-ID & log-redaction filter** *(enforces NFR-AUD-4, NFR-SEC-1)*
Generate `correlation_id` at every edge; install a log serializer that drops/masks any field matching card-data or secret patterns.
- **DoD:** a unit test feeds a payload containing a fake PAN + Stripe secret through the logger and asserts neither appears in output; all logs for one request share a correlation_id.

### T-1 — Create a recurring pledge (MO-1)

**T-1.1 — Validate create-pledge input.** Amount > minimum (e.g. ≥ 100 minor units), supported currency, active fund, valid interval (`month`/`year`), donor owns the referenced `payment_method`.
- **DoD:** each invalid field returns a specific `VALIDATION_ERROR` with the offending field; inactive fund → `VALIDATION_ERROR`; payment method not owned by donor → `403 FORBIDDEN`.

**T-1.2 — Resolve/create Stripe Price for (amount, currency, interval).** Reuse an existing Price if one matches; else create one.
- **DoD:** two pledges with identical amount/currency/interval reference the same `stripe_price_id`; no duplicate Prices created under retry (idempotent via T-0.3).

**T-1.3 — Create pledge in `pending` + create Stripe Subscription.** Persist pledge first as `pending`, then create the subscription with the donor consent metadata (NFR-POL-4).
- **DoD:** pledge row exists with `pending` state and `stripe_subscription_id` before any charge; consent timestamp recorded in audit; idempotency-safe (T-0.2/0.3) so a retried create yields one pledge + one subscription.

**T-1.4 — Confirm activation on `invoice.paid` webhook.** Transition `pending → active`, store `current_period_end`, append a gift record to the donor ledger, trigger receipt notification.
- **DoD:** on first `invoice.paid`, pledge is `active`, next charge date is set and returned to the donor; gift appears in donor ledger; receipt notification triggered exactly once.

**T-1.5 — Handle first-charge failure on create.** If the initial invoice fails, pledge does **not** become `active`; it remains `pending` and the donor receives an actionable `PAYMENT_FAILED` with a retry link. If no successful payment arrives within the grace window (default: 24 h, config-driven), the pledge automatically transitions `pending → canceled`.
- **DoD:** simulated initial decline leaves pledge in `pending` (not `active`), emits audit, notifies donor with a retry path; no gift record written. After grace-window expiry with no recovery, pledge is `canceled`, fully audited, donor notified; no zombie `pending` records persist.

**T-1.6 — Expose `POST /pledges` + donor confirmation payload.** Return pledge summary including amount (minor units + currency), interval, fund, next charge date, and state.
- **DoD:** response matches the documented schema; amount is minor units + currency (never pre-formatted); next charge date present for `active`/`pending`.

### T-2 — Pause & resume (MO-2)

**T-2.1 — Pause: `active → paused`.** Pause the Stripe subscription (`pause_collection`) so no invoices generate; record actor + reason.
- **DoD:** while paused, no `invoice.paid` occurs for the pledge; transition audited with actor; illegal pause from `canceled`/`unpaid` → `409 CONFLICT`.

**T-2.2 — Resume: `paused → active`.** Un-pause; charging resumes on the next natural cycle (no immediate catch-up charge unless policy says so — default: no catch-up).
- **DoD:** resume produces no immediate charge by default; `current_period_end` recalculated; transition audited.

**T-2.3 — Guard double-pause / double-resume.** Idempotent: pausing an already-paused pledge is a no-op success, not an error or second Stripe call.
- **DoD:** repeated pause/resume calls converge to the correct state with at most one Stripe mutation; audit records the no-op as a rejected/duplicate attempt, not a state change.

### T-3 — Change amount (MO-3)

**T-3.1 — Validate amount change.** New amount valid + different from current; currency unchanged (currency change is out of scope, §4.1).
- **DoD:** same-amount change → `VALIDATION_ERROR` (no-op rejected); currency change attempt → `VALIDATION_ERROR` pointing to cancel+recreate.

**T-3.2 — Apply change effective next cycle.** Resolve/create the new Price, update the subscription to take effect at `current_period_end` (no proration / no mid-cycle charge), per §4.6.
- **DoD:** the *current* period's charge is unchanged; the *next* invoice uses the new amount; effective date returned to donor.

**T-3.3 — Record amount history.** Close the prior `pledge_amount_history` row (valid-to) and open a new one (valid-from = effective date).
- **DoD:** history query returns a contiguous, non-overlapping timeline of amounts; prior amount remains queryable.

**T-3.4 — `PATCH /pledges/{id}/amount` + confirmation.** Donor sees old → new amount and the effective date before confirming (NFR-POL-4).
- **DoD:** response states new amount, effective date, and unchanged next-charge-this-cycle; audited with actor.

### T-4 — Cancel (MO-4)

**T-4.1 — Cancel: `active | paused | past_due | pending → canceled`.** Cancel the Stripe subscription in the mode requested by the actor (at-period-end or immediate per §4.6), stop future invoices, retain the record.
- **DoD:** no invoices created or charged after the effective end date (`cancellation_effective_at`: now for immediate, `current_period_end` for at-period-end); pledge queryable in `canceled` with cancel timestamp, actor, mode (`at_period_end` / `immediate`), and `cancellation_effective_at`; response states the effective end date; cancel from `canceled` → idempotent no-op (not error). For at-period-end, the `customer.subscription.deleted` webhook arriving at period end is a no-op (pledge already `canceled`).

**T-4.2 — No auto-refund on cancel (NFR-POL-1).** Cancellation does not refund past gifts; if a refund is desired, emit a *refund request* to the ops/finance queue (refund execution out of scope).
- **DoD:** canceling never calls Stripe refund; an optional refund-request flag enqueues an ops task with pledge + last-gift reference, audited.

**T-4.3 — `DELETE /pledges/{id}` (soft).** Terminal state, record retained ≥7 years (NFR-AUD-3); not a hard delete.
- **DoD:** record still retrievable after cancel; no row physically deleted; audit retained.

### T-5 — Dunning / failed-renewal recovery (MO-5)

**T-5.1 — Enter `past_due` on `invoice.payment_failed`.** Transition `active → past_due`, create `dunning_attempt #1`, notify donor with update-payment-method link.
- **DoD:** failed renewal moves pledge to `past_due`, first attempt recorded, donor notified once; no gift record for the failed charge.

**T-5.2 — Retry schedule worker.** Advance attempts on a defined schedule (assumed: day 0, 3, 5, 7) honoring Stripe's own retry where applicable; cap at **4 attempts** (matching the four schedule days).
- **DoD:** attempts fire on schedule; each is idempotent (no double-charge); schedule and 4-attempt cap are config-driven and documented.

**T-5.3 — Recover: `past_due → active`.** On a later `invoice.paid`, clear dunning, resume normal schedule, append the recovered gift, notify donor.
- **DoD:** recovery returns pledge to `active`, dunning attempts closed as resolved, exactly one gift recorded for the recovered invoice.

**T-5.4 — Exhaust: `past_due → unpaid` (terminal).** After 4 failed attempts (the configured cap), move to `unpaid`, stop retries, notify donor + flag ops.
- **DoD:** after the 4-attempt cap, pledge is `unpaid`, no further charges attempted, donor + ops notified, fully audited.

### T-6 — Reconciliation & webhook integrity (MO-6)

**T-6.1 — Verify + enqueue webhooks.** Validate `Stripe-Signature` (NFR-SEC-4); reject invalid; enqueue valid events to the durable queue; ACK fast.
- **DoD:** invalid signature → rejected + logged, never processed; valid event enqueued; endpoint returns 2xx within the latency budget (§9) so Stripe doesn't over-retry.

**T-6.2 — Exactly-once application (dedupe).** Before applying, check `processed_webhook_event` by `event.id`; skip if seen; record after success.
- **DoD:** redelivering the same `event.id` 3× causes one state change + one ledger entry; concurrent delivery of the same event doesn't double-apply (row-level lock / unique constraint).

**T-6.3 — Out-of-order tolerance.** Apply events using Stripe object version / timestamps so a stale event can't overwrite newer state.
- **DoD:** delivering `subscription.updated` events out of order converges to the latest Stripe state; older event is ignored, logged as out-of-order.

**T-6.4 — Reconciliation job.** Periodically diff platform pledges vs. Stripe subscriptions; emit mismatches to an ops queue with the discrepancy detail.
- **DoD:** a deliberately divergent pledge (e.g. canceled in Stripe, active locally) is detected and flagged within the job's SLA; matching pledges produce no noise.

**T-6.5 — Dead-letter handling.** Webhook events that fail processing after retries land in a DLQ with context for manual replay.
- **DoD:** a poisoned event is retried per policy then DLQ'd, not lost; replaying from DLQ is idempotent (T-6.2).

### T-7 — Ops/compliance view & intervention (MO-7)

**T-7.1 — Pledge timeline read API.** Return the immutable audit/event timeline for a pledge (state transitions, charges, dunning, actor per event).
- **DoD:** timeline is read-only, ordered, complete (every audited action appears), and paginated (§9).

**T-7.2 — RBAC enforcement (NFR-POL-3).** Enforce `support`/`finance`/`compliance` permissions server-side on every ops action.
- **DoD:** `support` can pause but not refund-request or cancel; `compliance` is read-only; `finance` can cancel + refund-request; forbidden action → `403`, audited as a denied attempt.

**T-7.3 — Ops-initiated pause/cancel.** Reuse T-2/T-4 paths with ops actor attribution and mandatory reason.
- **DoD:** ops action requires a reason string; audit attributes the named ops user, not "system"; donor notified of the ops-initiated change.

**T-7.4 — Refund-request hand-off.** `finance` raises a refund request (pledge + gift reference + reason) onto the ops/finance queue.
- **DoD:** request is enqueued + audited; no Stripe refund executed here (out of scope); duplicate request for same gift is deduped.

**T-7.5 — Audit export for compliance.** `compliance` can export a pledge's full audit trail (e.g. CSV/JSON) over a date range.
- **DoD:** export contains all events with actor/timestamp/correlation_id; export action is itself audited; PII handling follows NFR-SEC-2.

---

## 7. Edge Cases & Failure Modes

Scoped to the recurring-donation feature. Each row states **expected behavior** (user-visible + audit/compliance implication). `→` references the task/NFR that handles it.

### 7.1 Empty / boundary states

| Case | Expected behavior |
|------|-------------------|
| Donor has no saved payment method at create | Reject `VALIDATION_ERROR` ("add a payment method first"); no pledge created. → T-1.1 |
| Amount below minimum or zero/negative | `VALIDATION_ERROR` on amount; pledge not created. → T-1.1 |
| Fund inactive/archived at create time | `VALIDATION_ERROR`; pledge not created (don't pledge to a closed fund). → T-1.1 |
| List pledges for donor with none | `200` empty list (not `404`); donor portal shows empty state. → T-7.1 pattern |
| Change amount to the same value | `VALIDATION_ERROR` (no-op rejected) — avoids a meaningless Stripe write + audit noise. → T-3.1 |

### 7.2 Partial failures

| Case | Expected behavior |
|------|-------------------|
| Pledge row created, Stripe subscription create fails | Pledge stays `pending`; surfaced as retryable; reconciliation/cleanup ensures no orphan; donor sees "couldn't start, try again". → T-1.3, T-6.4 |
| Stripe subscription created, our DB commit fails | Outbound idempotency key means retry re-attaches to the same Stripe subscription instead of creating a second. → T-0.3, T-1.3 |
| `invoice.paid` received but donor-ledger append fails | Pledge still activates; ledger append retried via queue; mismatch flagged if unrecovered. → T-1.4, T-6.5 |
| Notification send fails after a successful charge | Charge/state stand; notification retried; failure logged, never blocks the financial outcome. → NFR-REL-5 |

### 7.3 Concurrency

| Case | Expected behavior |
|------|-------------------|
| Donor cancels at the same instant a renewal charges | Serialize per-pledge (row lock / version). If charge committed first, gift stands + cancel applies to future; if cancel first, in-flight charge is reconciled (refund-request if already captured). Never both "canceled" and "newly charged" silently. → T-4.1, T-6.3 |
| Two amount-change requests race | Last-writer-wins by version; the superseded change is rejected `409`, not silently lost; history stays contiguous. → T-3.2, T-3.3 |
| Same webhook delivered twice concurrently | Unique constraint on `event.id` + lock → exactly one application. → T-6.2 |
| Donor pauses while a renewal invoice is mid-creation | Pause applies from next cycle; the in-flight invoice either completes (gift recorded) or is voided per Stripe timing — outcome is deterministic and audited, never ambiguous. → T-2.1, T-6.3 |

### 7.4 Stale data & ordering

| Case | Expected behavior |
|------|-------------------|
| Out-of-order `subscription.updated` events | Apply by Stripe object version/timestamp; stale event ignored + logged. → T-6.3 |
| Donor portal shows pre-change amount right after a change | Read-after-write target (§9); UI reflects effective-dated change with explicit effective date so "still old amount this cycle" is correct, not stale. → §9, T-3.4 |
| Reconciliation finds local `active` but Stripe `canceled` | Flag to ops; do not auto-resurrect or auto-cancel without the rule; ops resolves. → T-6.4, NFR-REL-3 |

### 7.5 Permission boundaries

| Case | Expected behavior |
|------|-------------------|
| Donor A acts on Donor B's pledge | `403 FORBIDDEN`; attempt audited (potential abuse signal). → NFR-SEC-3 |
| `support` ops user attempts a refund request or cancel | `403`; audited as denied; UI hides the control but server is the enforcer. → T-7.2 |
| `compliance` user attempts any mutation | `403`; read/export only. → T-7.2 |
| Unauthenticated request to any mutating endpoint | `401`; nothing applied. → NFR-SEC-3 |

### 7.6 Fraud-ish / abuse patterns

| Case | Expected behavior |
|------|-------------------|
| Rapid create→cancel→create cycling (card testing) | Rate-limit create per donor/IP (§9); repeated failed initial charges trip a velocity check and require review; audited. → §9, T-1.5 |
| Many small pledges from one donor to many funds in seconds | Velocity/anomaly flag to ops; not auto-blocked but surfaced. → T-6.4 |
| Repeated dunning failures across donors spiking | Ops alert (possible BIN/issuer issue); dunning cap still enforced per pledge. → T-5.4 |
| Webhook endpoint hit with forged payloads | Signature verification rejects all; spike in rejections alerts ops. → NFR-SEC-4, T-6.1 |

---

## 8. Verification

How we **know** each mid-level objective is met. Test categories are documentation of intent (not executable here). Stripe interactions are exercised against **Stripe test mode + the Stripe CLI webhook fixtures**, never live cards.

### 8.1 Test categories & fixtures

| Category | What it covers | Key fixtures |
|----------|----------------|--------------|
| **Unit** | Validation, money math (minor units), state-machine legality, error-taxonomy mapping, log redaction | Boundary amounts, every illegal transition in §4.4, payloads with fake PAN/secret |
| **Integration (Stripe test mode)** | Create/pause/resume/change/cancel against test subscriptions; webhook handling | Test customer + test payment methods: `pm_card_visa` (success), `pm_card_chargeDeclined` (decline), `pm_card_chargeCustomerFail` (renewal fail) |
| **Webhook simulation** | Idempotency, ordering, signature failure, DLQ | `stripe trigger invoice.paid`, `invoice.payment_failed`, duplicated/reordered `event.id`s, tampered signatures |
| **End-to-end (documentation)** | Full donor journeys: create→active→change→cancel; create→fail→dunning→recover; create→fail→dunning→unpaid | Scripted journeys mapped to MO-1..5 |
| **Reconciliation** | Diff job correctness | Seeded divergences (canceled-in-Stripe-active-locally, amount drift) |
| **Compliance review (manual)** | Audit completeness, RBAC, PII handling, retention | Audit export sample, role matrix walkthrough |

### 8.2 Per-objective verification

| MO | How it's proven (review checkpoint / test) |
|----|---------------------------------------------|
| **MO-1 Create** | Integration test: create → `pending`, first `invoice.paid` → `active` with next-charge date; gift recorded once; **acceptance:** retried create (same idempotency key) yields exactly one pledge + one Stripe subscription (T-1.3, T-0.2/0.3). |
| **MO-2 Pause/Resume** | Integration: paused pledge generates no invoices over a simulated cycle; resume produces no catch-up charge; double-pause is a no-op (T-2.3). **Acceptance:** zero `invoice.paid` events while paused. |
| **MO-3 Change amount** | Integration: current-cycle charge unchanged, next invoice uses new amount; `pledge_amount_history` timeline contiguous & non-overlapping (T-3.3). **Acceptance:** effective date returned and honored. |
| **MO-4 Cancel** | Integration: no invoices post-cancel; record still queryable; no Stripe refund called (T-4.2). **Acceptance:** cancel is idempotent; refund-request enqueued only when flagged. |
| **MO-5 Dunning** | Webhook sim: `payment_failed` → `past_due` + attempt #1; schedule advances to cap; recovery path → `active` (one gift); exhaustion → `unpaid`. **Acceptance:** no double-charge across retries; attempts + outcomes fully audited. |
| **MO-6 Reconciliation** | Webhook sim: same `event.id` ×3 (concurrent) → one state change + one ledger entry; out-of-order updates converge to latest; reconciliation job flags seeded divergence within its SLA; poisoned event lands in DLQ and replays idempotently. **Acceptance:** exactly-once effect proven. |
| **MO-7 Ops/Compliance** | RBAC matrix test: each role × each action returns the expected allow/deny, denials audited; timeline read is complete + ordered; compliance export contains every event with actor/correlation_id. **Acceptance:** no mutation path bypasses RBAC; "system"-only attribution is absent. |

### 8.3 Cross-cutting verification gates (CI / review)

- **Audit-coverage test** (referenced by T-0.4): a static/integration check asserting every state transition emits an audit event with a non-null named actor — fails the build if a transition path skips `emitAudit`.
- **Redaction test** (T-0.5): asserts no PAN/secret pattern reaches logs.
- **Idempotency contract test**: every mutating endpoint rejects a missing key and replays correctly on a duplicate key.
- **State-machine property test**: random transition sequences never reach a state outside §4.4; illegal transitions always yield `409`.
- **Definition of Done for a task** = its DoD bullet passes + audit + redaction gates green + no new lint/type errors.

---

## 9. Expected Performance

All numbers are **assumed targets** for a mid-size nonprofit platform (hundreds of thousands of donors, renewal charges spread across the month, spiky giving around campaigns/year-end). They are chosen for FinTech UX (donor actions feel instant) and ops safety (no payment event lost), and should be load-tested before launch.

### 9.1 Latency budgets (API)

| Operation | Target (assumed) | Rationale |
|-----------|------------------|-----------|
| Read pledge / list pledges | **p50 < 100 ms, p95 < 300 ms, p99 < 500 ms** | Donor-portal reads must feel instant; served from our DB, no Stripe call on the hot path. |
| Create pledge (`POST /pledges`) | **p95 < 1.5 s, p99 < 2.5 s** | Includes a synchronous Stripe subscription create; activation itself is confirmed async via webhook, so the request returns on `pending` quickly. |
| Pause / resume / change / cancel | **p95 < 1.2 s** | One Stripe write + one DB write; effective-dated so no charge happens on the request path. |
| Webhook ingest ACK (`T-6.1`) | **p95 < 250 ms, p99 < 500 ms** | Must verify + enqueue + 2xx fast so Stripe doesn't treat it as failed and over-retry; heavy work is async off the queue. |
| Ops timeline read | **p95 < 400 ms** | Paginated audit read; bounded page size keeps it flat. |

### 9.2 Throughput & background jobs

| Concern | Target (assumed) | Rationale |
|---------|------------------|-----------|
| Webhook processing throughput | **≥ 200 events/sec sustained, burst 1000/sec** absorbed by the queue | Year-end + monthly renewal clustering causes Stripe event bursts; the durable queue smooths spikes so ACK latency holds. |
| Dunning worker | Process all due attempts within **15 min** of their scheduled time | Timely retries improve recovery without feeling punitive. |
| Reconciliation job | Full sweep of active pledges **≤ 1×/24h**; targeted diffs **hourly**; flag divergence within **1h** | Daily full reconciliation is standard for payment platforms; hourly targeted catches drift fast without hammering Stripe's API. |

### 9.3 Pagination, rate limits, consistency

| Rule | Target (assumed) | Rationale |
|------|------------------|-----------|
| Pagination | Cursor-based; **default page 25, max 100** items; no offset paging on large sets | Stable pages under concurrent writes; bounds query cost (keeps §9.1 reads flat). |
| Donor mutation rate limit | **create: 5/min per donor**, general mutations **30/min per donor**; **per-IP** create cap to blunt card-testing | Anti-abuse (§7.6) without hindering legitimate use. |
| Stripe API call budget | Respect Stripe's rate limits; client-side limiter + backoff (T-0.3) | Avoid `429` cascades during bursts. |
| Read-after-write consistency | A donor's own mutation is reflected in their next read within **< 1 s** (read-your-writes on the primary); cross-actor/reporting reads may be **eventually consistent ≤ 5 s** | Donors must see their own change immediately (trust); analytics tolerates slight lag. |
| Effective-date clarity | Amount/cancel changes show the **effective date** explicitly so an unchanged current-cycle charge is never perceived as stale data | Prevents "the app is wrong" support tickets (§7.4). |

> **Why these are reasonable:** sub-300 ms reads and sub-2.5 s Stripe-backed writes match common FinTech donor-portal UX expectations; the 99.95% webhook availability (NFR-REL-4) + queue-backed ≥200 eps throughput reflect that **losing a payment event is the worst failure** in this domain; daily reconciliation with hourly targeted diffs mirrors standard payment-platform practice. All should be validated under load (campaign/year-end profile) and revised with real telemetry.
