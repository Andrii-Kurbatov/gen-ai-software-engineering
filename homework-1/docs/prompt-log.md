# AI Prompt Log — Homework 1

Documents the prompts used with **Claude Code** during development of the Banking Transactions API.

---

## 1. Project Scaffolding

**Prompt:**
> Let's start with implementation of requirements of 1st task of 1st HW. I'd like to go with Node.js + Express.js on top, propose me alternatives and shortly explain upsides/downsides of each combination.

**What AI did:** Proposed Express.js, Fastify, Hono, and NestJS with tradeoffs. Recommended Fastify for its built-in JSON Schema validation.

---

## 2. Validation Library Choice

**Prompt:**
> What are joi alternatives for schema validation for express? Propose variants with upsides/downsides shortly.

**What AI did:** Compared Zod, Yup, Joi, express-validator, and ajv. Recommended Zod as the current community standard. Student chose Joi instead.

---

## 3. Task 1 — Core API Implementation

**Prompt:**
> Let's start with HW 1, task 1. I'll use Node.js with Express.js + joi.

**What AI generated:**
- `package.json` with express, joi, uuid dependencies
- `src/index.js` — server entry point
- `src/app.js` — Express setup with middleware and error handlers
- `src/store/transactions.js` — in-memory store with `findAll`, `findById`, `insert`
- `src/routes/transactions.js` — POST/GET /transactions, GET /transactions/:id
- `src/routes/accounts.js` — GET /accounts/:accountId/balance with per-direction balance logic
- `src/validators/transaction.js` — Joi schema stub + `validate()` middleware factory

---

## 4. Tasks 2 & 3 — Validation and Filtering

**Prompt:**
> Let's implement task 2 and 3.

**What AI generated:**
- Tightened Joi schema: `ACC-XXXXX` pattern, `currency-codes` package for full ISO 4217, positive amount with max 2 decimal places, type enum
- `filter({ accountId, type, from, to })` helper in the store
- Date filter validation in the route (400 on malformed input)

---

## 5. Task 4 Option A — Transaction Summary

**Prompt:**
> Let's implement HW1 Task 4 Option A.

**What AI generated:**
- `GET /accounts/:accountId/summary` route returning `totalDeposits`, `totalWithdrawals`, `transactionCount`, `mostRecentTransaction`
- Extracted shared `computeBalances()` helper to remove duplication across routes

---

## 6. Task 4 Option B — Simple Interest

**Prompt:**
> Let's implement Option B.

**What AI generated:**
- `GET /accounts/:accountId/interest?rate=0.05&days=30` route
- Per-currency interest calculation using `principal × rate × (days / 365)`
- Input validation for `rate` and `days` query params

---

## 7. Code Review — Round 1 (Tasks 1–3)

**Prompt:** *(Provided a structured review with 1 High, 2 Medium, 1 Low issues)*

**Issues fixed:**
- **High:** Conditional account validation — `fromAccount` forbidden on deposits, `toAccount` forbidden on withdrawals (Joi `when/switch`)
- **Medium:** Currency list replaced with `currency-codes` package (UAH and other missing codes now accepted)
- **Medium:** Balance calculation fixed to return per-currency map instead of single number
- **Medium:** `README.md` and `HOWTORUN.md` written with full content
- **Low:** Date filter now returns 400 for malformed `from`/`to` values

---

## 8. Code Review — Round 2 (Task 4)

**Prompt:** *(Provided a structured review with 2 High, 2 Medium, 1 Medium docs issues)*

**Issues fixed:**
- **High:** Summary now returns per-currency `totalDeposits`/`totalWithdrawals` maps
- **High:** Deposits with `fromAccount` or withdrawals with `toAccount` rejected at validation — prevents false account associations in summary/interest
- **Medium:** Interest parsing replaced `parseFloat` with `Number()` + `isFinite()` — rejects `0.05abc`, `Infinity`, `1e999`
- **Medium:** Negative balances earn 0 interest; listed in `overdraftCurrencies` in response
- **Medium:** README and HOWTORUN updated with Task 4 endpoints and examples

---

## 9. Account ID Format Validation

**Prompt:**
> Account IDs in Task 4 routes are not validated. /accounts/not-an-account/summary returns 404 instead of 400.

**What AI generated:**
- `router.param('accountId', ...)` middleware in `accounts.js` — fires before all three route handlers
- `ACCOUNT_PATTERN` exported from `validators/transaction.js` to avoid duplication

---

## 10. Documentation Consistency Fix

**Prompt:**
> HOWTORUN.md sample outputs are not up to date. After the three documented requests, ACC-AA111 would have USD: -300, not USD: 700.

**What AI fixed:**
- Added USD deposit as first sample request so the 4-step sequence produces `{ USD: 700, UAH: 1000 }`
- Corrected balance, summary, and interest expected outputs to match the updated sequence
- Softened README wording about interest param parsing ("strictly parsed" → accurate description)

---

## 11. Demo Files

**Prompt:**
> From Deliverables section work on 4th part "Demo Files".

**What AI generated:**
- `demo/run.sh` — portable start script (auto-installs deps, works from any directory)
- `demo/sample-requests.http` — 23 annotated HTTP requests for VS Code REST Client / JetBrains
- `demo/sample-data.json` — seed transactions with `expectedState` for both accounts

---

## 12. Default Transaction Status

**Prompt:**
> Change standard status to completed.

**What AI changed:** `status: 'pending'` → `status: 'completed'` in `src/store/transactions.js`.
