# Agent Guidelines — Recurring Donation Lifecycle

> Rules for an AI coding agent implementing the feature described in `specification.md`.
> Read this file in full before writing any code. These rules override general defaults.

---

## 1. Tech Stack Assumptions

| Concern | Assumed choice | Notes |
|---------|---------------|-------|
| **Language** | TypeScript (Node.js) | Strict mode on. No `any` except at narrow serialization boundaries. |
| **Web framework** | Express (or Fastify) | Thin HTTP layer; business logic lives in domain services, not route handlers. |
| **Database** | PostgreSQL | Use parameterized queries or an ORM that never interpolates raw user input into SQL. Migrations via a dedicated tool (e.g. `node-postgres-migrate` or Knex). |
| **Queue** | AWS SQS (or GCP Pub/Sub) | For webhook ingestion and background jobs. Assume at-least-once delivery. |
| **Stripe SDK** | `stripe` npm package (latest stable) | Always use the typed SDK; never call Stripe's REST API directly. |
| **Secrets** | AWS Secrets Manager (or equivalent) | Never read from `.env` files or process.env for Stripe keys; always fetch from the secrets provider at startup. |
| **Testing** | Jest + Supertest for integration; Stripe test mode + Stripe CLI for webhook simulation | No live card data, ever. |

If a specific library is not listed here, prefer the most widely adopted option for the ecosystem and justify the choice in a code comment.

---

## 2. Domain Rules

These are invariants the agent must enforce in every code path it touches. Violating any of them is a bug, not a style issue.

### 2.1 Money

- **Store money as integer minor units + ISO-4217 currency code.** `$25.00/month` → `{ amount_minor: 2500, currency: "USD" }`. Never use `float`, `double`, or `Decimal` string without converting to integer first.
- **Never do arithmetic directly on raw API amounts** without first confirming the unit. Stripe amounts are already minor units; document the assumption at call sites.
- **Currency is immutable per pledge.** If an amount-change request tries to change the currency, reject it with `VALIDATION_ERROR` pointing to "cancel + create new pledge."
- **Never format money as a pre-formatted string** in API responses. Always return `{ amount_minor: number, currency: string }` and let the caller format.

### 2.2 State Machine

- The only legal pledge state transitions are those in `specification.md §4.4`. Encode them as an explicit allowlist (a `Map<PledgeState, Set<PledgeState>>` or equivalent), not as scattered `if` checks.
- Any attempted transition not in the allowlist must throw a domain error that maps to `409 CONFLICT` and **must** emit an audit event recording the rejected attempt.
- Never mutate pledge state outside the domain service that owns the state machine.

### 2.3 Idempotency

- Every mutating API endpoint must require an `Idempotency-Key` header. Missing key → `400 VALIDATION_ERROR` before any business logic runs.
- Persist `{ key, scope, request_fingerprint, result_payload, expires_at }` and replay the stored result on retry. Same key + different body → `409 CONFLICT`.
- Every outbound Stripe write must include a deterministic idempotency key: `pledge_<id>:<operation>:<relevant-discriminant>` (e.g. `pledge_abc123:amount-change:price_xyz`).

### 2.4 Stripe Mapping

- Each pledge row must store `stripe_customer_id`, `stripe_subscription_id`, and `stripe_price_id`. Never derive one from the other; always read from the DB.
- Stripe is the source of truth for whether money actually moved. The platform is the source of truth for donor intent and designation.
- On conflict between local state and Stripe: surface the mismatch to ops via the reconciliation queue; do not silently overwrite either side.

### 2.5 Cancellation Modes

- Cancellations have exactly two modes: `at_period_end` (default) and `immediate`. This must be an explicit parameter on any cancel API; never infer the mode from context.
- For `at_period_end`: set `cancel_at_period_end=true` on the Stripe subscription; store `cancellation_mode` and `cancellation_effective_at = current_period_end` on the pledge; the incoming `customer.subscription.deleted` webhook at period end is a no-op (pledge already `canceled`).
- For `immediate`: cancel the Stripe subscription immediately; store `cancellation_effective_at = now`.

### 2.6 Effective Dating

- Amount changes are never applied mid-cycle. Always schedule at `current_period_end` on the Stripe subscription (`proration_behavior: 'none'`).
- Every `change_amount` call must close the current `pledge_amount_history` row (`valid_to = effective_date`) and open a new one (`valid_from = effective_date`). Prior amounts must remain queryable.

---

## 3. Code Style

- **No `any` in domain or service layers.** Use it only for raw JSON deserialization at the edge, cast immediately.
- **Prefix internal IDs with their entity type:** `pledge_`, `donor_`, `fund_`, `audit_`. Use UUID v4 for the opaque part.
- **Error taxonomy is fixed** (`specification.md §4.5`). Every thrown error must carry a `code` from that taxonomy. Never surface raw Stripe error codes or HTTP status text to callers.
- **One responsibility per file.** Route handlers call service functions; service functions call the repository and the Stripe client wrapper; the state machine is its own module. Keep layers separate.
- **No inline SQL strings in service code.** All DB queries go through the repository layer.
- **Correlation IDs are generated at the request/webhook edge** and threaded through as a parameter (not a global). Every log statement and audit event carries `correlation_id`.
- **Comments explain WHY, not WHAT.** If the code is not self-explanatory via naming, explain the constraint or invariant, not the mechanics.

---

## 4. Testing & Verification Expectations

### 4.1 What must be tested

| Layer | What to cover |
|-------|--------------|
| **Unit** | State machine: every legal and every illegal transition. Money math: boundary amounts (0, 1, min_valid, max_int). Validation: each required field missing or invalid. Error taxonomy: Stripe error types map to the correct internal code. Log redaction: a payload with a fake PAN/CVV/Stripe secret key passes through the logger and none appear in output. |
| **Integration (Stripe test mode)** | Create → `pending` → `active` (via `invoice.paid`). Pause/resume cycle with no intervening charge. Amount change: current charge unchanged, next invoice uses new amount. Cancel (both modes). Dunning: `invoice.payment_failed` → `past_due` → recovery and → `unpaid`. |
| **Webhook simulation** | Same `event.id` delivered 3× concurrently → exactly one state change + one ledger entry. Out-of-order `subscription.updated` → converges to latest. Tampered signature → rejected, logged, never applied. DLQ: poisoned event lands in DLQ after retry cap, replay is idempotent. |
| **Idempotency contract** | Every mutating endpoint: missing key → 400; same key + same body → original result, no side-effect; same key + different body → 409. |
| **State machine property** | Random valid + invalid transition sequences never reach a state outside the legal set; illegal transitions always yield 409. |
| **RBAC** | `support` role: can pause, cannot cancel or refund-request. `finance` role: can cancel and refund-request. `compliance` role: read-only, all mutations 403. Unauthenticated: all mutations 401. |

### 4.2 Test fixtures

- Use Stripe test payment methods: `pm_card_visa` (success), `pm_card_chargeDeclined` (decline on create), `pm_card_chargeCustomerFail` (renewal failure for dunning).
- Use the Stripe CLI (`stripe trigger`) to replay webhook payloads for integration tests.
- Seed the DB with a known `donor_<id>`, `stripe_customer_id`, and at least one attached test payment method before any test that exercises the create-pledge path.

### 4.3 Definition of done for a task

A task is complete when:
1. Its DoD bullets from `specification.md` all pass.
2. The audit-coverage assertion is green (every state transition emits an audit event with non-null `actor` and `correlation_id`).
3. The log-redaction test is green (no PAN/CVV/secret in output).
4. No new TypeScript errors or lint violations are introduced.

---

## 5. Security & Compliance Constraints

- **Never log, store, or transmit raw card data (PAN, CVV, expiry).** Install a log serializer that masks any field matching card-data or secret patterns before the log line is written. This is a hard stop, not a best-effort.
- **Verify every inbound Stripe webhook signature** (`Stripe-Signature` header + signing secret) before any processing. Unverified payloads are rejected (logged as a security event) and never applied. Reject before enqueueing.
- **Stripe API keys and webhook secrets are read from the secrets manager at startup**, not from environment variables, `.env` files, or source code. Do not commit any key material.
- **All pledge mutations require an authenticated principal.** Donors may only act on their own pledges (enforce by querying `WHERE pledge_id = $1 AND donor_id = $authenticated_donor_id`). Cross-donor access attempts are `403 FORBIDDEN` and written to the audit log.
- **Ops actions require explicit roles** enforced server-side. Never rely on the UI to hide a button as the only access control.
- **PII (name, email, address) is encrypted at rest.** Amounts, currencies, and designations are not PII but are access-controlled. Do not include full PII in log lines; use `donor_id` only.
- **Audit records are never updated or deleted.** If the audit store exposes a delete API, the agent must not call it. Audit writes are append-only.
- **Financial records are retained ≥ 7 years.** Do not add any cascade-delete or TTL on `pledge`, `pledge_amount_history`, `dunning_attempt`, or `audit_event` rows.

---

## 6. Edge-Case Handling Rules

These are defaults the agent applies in all ambiguous situations. Do not deviate without an explicit comment explaining why.

| Rule | Default behavior |
|------|-----------------|
| **Stripe unreachable** | Return `503 UPSTREAM_UNAVAILABLE` with `retryable: true`. Never silently accept a mutation as if it applied. Queue or reject; never assume success. |
| **Notification send fails** | Log the failure; do not block or roll back the financial outcome. Retry via the queue. |
| **Donor-ledger append fails after `invoice.paid`** | Pledge still activates; ledger append is retried via queue. Mismatch is flagged to ops if unrecovered after the retry cap. |
| **DB commit fails after Stripe subscription created** | On retry, the outbound idempotency key on the Stripe call re-attaches to the existing subscription rather than creating a second. Never create two Stripe subscriptions for one pledge. |
| **Webhook delivered out of order** | Apply using the Stripe object's `updated` timestamp or `livemode`/version fields; if the incoming event is older than the stored state, log it as out-of-order and skip — do not overwrite newer state. |
| **Same `invoice.payment_failed` delivered twice concurrently** | Unique constraint on `processed_webhook_event.event_id` + row-level lock ensures exactly one `dunning_attempt` is created. The second concurrent handler is a no-op. |
| **`past_due → canceled` during dunning** | Valid transition (§4.4). Cancel the Stripe subscription immediately regardless of pending retry schedule; close all open `dunning_attempt` rows as `canceled`; audit with actor. |
| **Amount change to same value** | Reject with `400 VALIDATION_ERROR` before any Stripe call. Avoids unnecessary Stripe writes and audit noise. |
| **Rapid create→cancel cycling** | Rate-limit `POST /pledges` at 5/min per donor and per IP. Log each create attempt. Repeated initial-charge failures from the same donor trigger a velocity flag to ops. |
| **Refund on cancel** | Never call Stripe's refund API during a cancel flow. If the actor sets `request_refund: true`, enqueue a refund-request task (pledge + last gift reference + reason) for ops/finance to act on separately. |
