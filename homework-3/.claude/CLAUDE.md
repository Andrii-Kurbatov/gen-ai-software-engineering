# Claude Code Rules — Recurring Donation Lifecycle

> Loaded automatically by Claude Code when working in this directory.
> These rules narrow Claude's defaults for a FinTech/payments context.
> Read `agents.md` and `specification.md` for full context.

---

## Naming

- **Entity IDs**: prefixed UUID v4 — `pledge_<uuid>`, `donor_<uuid>`, `fund_<uuid>`, `audit_<uuid>`. Never sequential integers; never bare UUIDs without a prefix.
- **DB columns**: `snake_case`. TS variables/properties: `camelCase`. File names: `kebab-case.ts`.
- **Money columns**: always named `*_minor` (e.g. `amount_minor`) to make the unit self-documenting. Pair with a `currency` column of type `CHAR(3)`.
- **Stripe ID columns**: named exactly `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id` — no abbreviations, no aliases.
- **State column**: type `pledge_state` (a Postgres enum). Values: `pending | active | paused | past_due | canceled | unpaid`.
- **Idempotency keys** for outbound Stripe calls: `pledge_<id>:<operation>:<discriminant>` (e.g. `pledge_abc:amount-change:price_xyz`).

---

## Patterns to Always Follow

- **State machine as an allowlist.** Encode legal transitions as `Map<PledgeState, Set<PledgeState>>`. Every transition attempt checks the map; anything not in it throws a domain error → `409 CONFLICT` + audit event.
- **Repository layer owns all DB access.** Service functions call repository functions; they never construct SQL strings directly.
- **Stripe client wrapper owns all Stripe calls.** Pass a deterministic idempotency key on every write. Map every Stripe error to the internal taxonomy (`PAYMENT_FAILED`, `UPSTREAM_UNAVAILABLE`, etc.) before it leaves the wrapper.
- **`emitAudit()` on every state transition and every human action.** Fields: `pledge_id`, `actor` (never null, never bare `"system"`), `action`, `before_state`, `after_state`, `reason`, `source`, `correlation_id`, `timestamp`. Emitting audit is not optional — a transition without an audit event is a bug.
- **`correlation_id` is generated at the edge** (request handler / webhook handler / job entry point) and passed as a parameter through all downstream calls. Never use a global or thread-local for this.
- **Idempotency middleware runs before business logic.** Missing `Idempotency-Key` on a mutating endpoint → `400` before any service code executes. Same key + different fingerprint → `409`.
- **Webhook handler: verify signature first, then enqueue, then ACK.** Never apply business logic synchronously on the HTTP thread. Return `2xx` fast.

---

## What to Avoid

| Never do this | Do this instead |
|---------------|-----------------|
| `float` or `number` for money math | Store as `integer` minor units; do integer arithmetic only |
| `SELECT *` on pledge or audit tables | Name every column explicitly to avoid leaking new fields |
| Interpolating user input into SQL strings | Use parameterized queries always |
| Reading Stripe keys from `process.env` directly | Fetch from the secrets manager at startup |
| Calling Stripe's refund API during a cancel flow | Enqueue a refund-request task for ops; never auto-refund |
| Logging `donor.email`, `donor.name`, full webhook payload, or any card-like field | Log `donor_id` and `pledge_id` only; install the redaction serializer |
| Setting pledge state with a direct DB update outside the state machine module | Route all state changes through the domain service that owns the machine |
| Creating a new state outside `specification.md §4.4` | Use `cancellation_mode` + `cancellation_effective_at` fields instead of a new state |
| Silently accepting a mutation when Stripe is unreachable | Return `503 UPSTREAM_UNAVAILABLE` with `retryable: true` |
| Throwing a raw Stripe error up to the HTTP layer | Map to the internal error taxonomy in the Stripe client wrapper |

---

## FinTech-Sensitive Defaults

- **Log redaction is mandatory.** Before writing any log line, a serializer must strip fields matching PAN patterns (`/\b\d{13,19}\b/`), CVV patterns (`/\bcvv?\b/i`), and Stripe secret key patterns (`/sk_(live|test)_[A-Za-z0-9]+/`). Add a unit test asserting this.
- **No raw card data ever enters the backend.** If you find yourself handling a PAN, stop and re-read `specification.md §NFR-SEC-1`.
- **Webhook signature verification is not optional.** Any code path that processes a Stripe payload without first calling `stripe.webhooks.constructEvent(payload, sig, secret)` is a security defect.
- **Audit records are append-only.** Do not add `UPDATE` or `DELETE` methods to the audit repository.
- **Financial rows (`pledge`, `pledge_amount_history`, `dunning_attempt`) have no TTL and no cascade delete.** Retention is ≥ 7 years per `specification.md §NFR-AUD-3`.
- **Exactly-once webhook processing.** Before applying any webhook event, check `processed_webhook_event` by `event.id`. Use a unique constraint + row-level lock, not an application-level check alone.
- **At-period-end cancellation does not mean "Stripe canceled."** The Stripe subscription stays `active` (with `cancel_at_period_end=true`) until the period ends. The local pledge is already `canceled`; the eventual `customer.subscription.deleted` webhook is a no-op.
