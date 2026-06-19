# Homework 3 — Build Checklist

Domain: **Recurring Donation lifecycle** (set up, pause/resume, change amount, cancel, failed-renewal dunning) — Stripe-backed, nonprofit/fundraising context
Stakeholders: donors (end-users) + internal ops/finance/compliance

---

## 1. `specification.md` (the graded core)
- [x] High-level objective — 1 crisp outcome + 1-sentence scope boundary
- [x] Mid-level objectives — several observable "what changes" statements
- [x] Non-functional & policy — security, privacy, audit/logging, reliability, **latency budgets as numbers**
- [x] Implementation notes — data handling (never log PAN), idempotency, error semantics, money/ID formatting
- [x] Context: beginning (what exists before) / ending (artifacts & state after)
- [x] Low-level tasks — **many small slices**, each tied to a mid-level objective, each with acceptance criteria / DoD
- [x] Edge cases & failure modes — table: empty states, partial failures, concurrency, invalid limits, stale data, permission boundaries, fraud patterns + expected behavior
- [x] Verification — how each mid-level objective is proven (test categories, fixtures, reconciliation, compliance review)
- [x] Performance — measurable targets (latency percentiles, pagination, rate limits, read-after-write consistency); label assumed targets + justify

## 2. `agents.md`
- [x] Tech stack assumptions
- [x] Domain rules (banking/FinTech)
- [x] Code style
- [x] Testing & verification expectations
- [x] Security & compliance constraints
- [x] Edge-case handling rules (never log PAN, prefer idempotent writes)

## 3. Editor / AI rules (one set)
- [x] `.cursor/rules/*.md` OR `.github/copilot-instructions.md` OR `.claude/` file
- [x] Naming, patterns, what to avoid, FinTech-sensitive defaults

## 4. `README.md`
- [ ] Student & task summary (name + brief)
- [ ] Rationale (why spec written this way; how perf targets & verification depth chosen)
- [ ] Industry best practices (which + **where they appear**, with file/section refs)

---

## Done when
- [ ] All 4 deliverables present in `homework-3/`
- [ ] Cross-cutting reqs (edge cases / verification / performance) live **inside spec**, not only README
- [ ] Traceability holds: goals → objectives → tasks
