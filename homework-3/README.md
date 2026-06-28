# Homework 3 — Specification-Driven Design

**Created by Andrii Kurbatov** (andrii.kurbatov.w@gmail.com)

## Student & task summary

This homework is a **specification-only** deliverable — no implementation. It designs a complete, layered specification for the **Recurring Donation Lifecycle** of *GivePlatform*, a nonprofit donor-CRM and billing-orchestration platform backed by **Stripe Billing**. The feature owns the lifecycle of a recurring pledge — creation, pause/resume, amount change, cancellation, and automated dunning on failed renewals — and is responsible for keeping the platform's donor ledger in agreement with Stripe (two systems of record that must always agree).

The submission package is:

| File | Purpose |
|------|---------|
| [`specification.md`](./specification.md) | The layered product/feature spec (the graded artifact) |
| [`agents.md`](./agents.md) | AI/agent guidelines — stack assumptions, domain rules, testing & verification, security/compliance, edge-case handling |
| [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) | Claude Code rules — FinTech-sensitive defaults (naming, patterns to follow, things to never do) |
| `README.md` | This file — rationale and industry best practices |

`specification.md` is organized into nine layers: **§1** High-Level Objective → **§2** Mid-Level Objectives (`MO-1…MO-7`, each an *observable* success signal) → **§3** Non-Functional & Policy (`NFR-*`) → **§4** Implementation Notes (money, IDs, idempotency, state machine, error semantics, effective-dating) → **§5** Context (beginning/ending state) → **§6** Low-Level Tasks (75 tasks labeled `T-<MO>.<n>`) → **§7** Edge Cases & Failure Modes → **§8** Verification → **§9** Expected Performance.

## Rationale

**Why this structure.** The goal was a spec an engineering team *and* an AI agent could execute without guessing. Three principles drove the shape:

- **End-to-end traceability.** Every low-level task in §6 is labeled `T-<MO>.<n>` and ties back to the mid-level objective it serves; §7 (edge cases), §8 (verification), and §9 (performance) each reference the `MO-*`/`NFR-*` they protect. A reader can follow any requirement from the north-star objective down to a checkable task and back up to the policy it satisfies.
- **Observable objectives, not aspirations.** Each mid-level objective (§2) is phrased as *what is verifiably different in the world* when it succeeds (e.g. "a `pledge` exists in `active` state, a matching Stripe Subscription exists, the first invoice is paid"), so success is testable rather than subjective.
- **Failure modes designed in, not bolted on.** Dunning (MO-5) and donor↔Stripe reconciliation (MO-6) treat partial failures, duplicate/out-of-order webhooks, and state divergence as first-class flows in §7, each with a stated user-visible outcome *and* its audit/compliance implication.

**How performance targets were chosen (§9).** Numbers are labeled as *assumed targets* and justified for FinTech UX/ops rather than asserted. Donor-facing read/write endpoints target **99.9%** monthly availability while webhook ingestion targets **99.95%** (§NFR-REL-4) — losing a payment event is worse than a page briefly failing to load, so the ingestion path is held to a higher bar and backed by a durable queue. Latency budgets (§9.1), background-job throughput (§9.2), and pagination/rate-limit/consistency rules (§9.3) are stated as ranges so they can be measured in CI and in production SLOs.

**How verification depth was chosen (§8).** Because this is a regulated, money-moving feature, verification is treated as part of the spec, not an afterthought: §8.1 defines test categories and fixtures, §8.2 gives per-objective verification, and §8.3 defines cross-cutting CI/review gates (e.g. the log-redaction unit test, exactly-once webhook test). Several §6 tasks end with acceptance criteria an implementer can check off.

## Industry best practices (and where they appear)

These FinTech/payments practices are encoded **in the spec and rules**, not just described here:

| Best practice | Where it appears |
|---------------|------------------|
| **PCI-DSS SAQ-A posture — no raw card data ever** (capture client-side via Stripe Elements; backend sees only opaque IDs) | `specification.md` §NFR-SEC-1; enforced in `.claude/CLAUDE.md` → *FinTech-Sensitive Defaults* + log-redaction patterns |
| **Append-only, fully attributable audit trail** (`actor` never bare `"system"`) | §NFR-AUD-1 / §NFR-AUD-2; `.claude/CLAUDE.md` → mandatory `emitAudit()` rule + append-only audit repository |
| **≥ 7-year retention for financial/audit records** (no TTL, no cascade delete) | §NFR-AUD-3; `.claude/CLAUDE.md` → *FinTech-Sensitive Defaults* |
| **Webhook signature verification before any processing** | §NFR-SEC-4; `.claude/CLAUDE.md` → "verify signature first, then enqueue, then ACK" |
| **Exactly-once webhook processing** (dedupe by Stripe `event.id`) | §NFR-REL-1 + MO-6; `.claude/CLAUDE.md` → exactly-once rule with unique constraint + row lock |
| **Idempotent money-adjacent writes** (client + Stripe idempotency keys) | §NFR-REL-2, §4.3; `.claude/CLAUDE.md` → idempotency-key format + middleware-before-business-logic |
| **Two systems of record reconciled** (Stripe = truth for money; platform = truth for intent; divergence surfaced, never silently overwritten) | §NFR-REL-3 + MO-6 |
| **Integer minor-unit money** (never `float`/`number`), `*_minor` columns + `CHAR(3)` currency | §4.1; `.claude/CLAUDE.md` → *What to Avoid* + naming rules |
| **State machine as an allowlist** with audited transitions; illegal transition → `409` + audit | §4.4; `.claude/CLAUDE.md` → *Patterns to Always Follow* |
| **Log hygiene / PII minimization** (no PAN/CVV/secret keys in logs; encrypt PII at rest/in transit) | §NFR-AUD-4, §NFR-SEC-2; `.claude/CLAUDE.md` → redaction serializer + *Never log* table |
| **Secrets management & rotation** (secrets manager, not env files; rotate ≤ 90 days) | §NFR-SEC-5; `.claude/CLAUDE.md` → "Reading Stripe keys from `process.env` directly" → fetch from secrets manager |
| **Graceful degradation under upstream failure** (queue or `503 retryable`, never silently accept) | §NFR-REL-5; `.claude/CLAUDE.md` → "Silently accepting a mutation when Stripe is unreachable" |
| **Effective-dating of amount changes** (no silent mid-cycle surprises) | §4.6 + MO-3 |
| **Automated dunning with bounded retries + donor notification** | MO-5 + §6 (T-5) |
| **Least-privilege, role-based ops intervention** | §NFR-SEC-3 + MO-7 |

## A note on AI tooling

The specification, `agents.md`, and the `.claude/CLAUDE.md` rules were authored and iterated with **Claude Code** (Opus 4.8 / Sonnet 4.6), using a brainstorm → plan → draft workflow to keep requirements traceable from goals down to individual tasks and to keep the cross-cutting security/audit/performance concerns consistent across all three documents.
