# 🏦 Homework 1: Banking Transactions API

> **Student Name**: [Andrii Kurbatov]
> **Date Submitted**: [29.04.2026]
> **AI Tools Used**: [Claude Code, Codex]

---

## 📋 Project Overview

A REST API for in-memory banking transactions built with Node.js, Express.js, and Joi. Implements all required tasks: core endpoints, request validation, transaction filtering, and account analytics (summary + interest).

---

## Features Implemented

### Task 1 — Core Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions` | Create a new transaction (201) |
| `GET` | `/transactions` | List transactions (with optional filters) |
| `GET` | `/transactions/:id` | Get transaction by ID (404 if missing) |
| `GET` | `/accounts/:accountId/balance` | Per-currency balance for an account |

### Task 2 — Validation
- **amount**: required, positive, max 2 decimal places
- **fromAccount / toAccount**: pattern `ACC-XXXXX` (5 alphanumeric chars); conditionally required by type:
  - `deposit` → `toAccount` required
  - `withdrawal` → `fromAccount` required
  - `transfer` → both required
- **currency**: full ISO 4217 code set via the `currency-codes` package
- **type**: one of `deposit | withdrawal | transfer`
- All errors collected in one pass, returned as `{ error, details[] }`

### Task 3 — Filtering
`GET /transactions` accepts any combination of:
- `?accountId=ACC-12345` — transactions involving this account
- `?type=transfer` — by transaction type
- `?from=2024-01-01` — on or after date (inclusive)
- `?to=2024-12-31` — on or before date (inclusive day)

Malformed `from` / `to` values return `400`.

### Task 4 — Account Analytics (Option A + B)

**Option A — Transaction Summary** `GET /accounts/:accountId/summary`
- `totalDeposits` / `totalWithdrawals` — per-currency maps (incoming transfers count as deposits, outgoing as withdrawals)
- `transactionCount` — total number of related transactions
- `mostRecentTransaction` — ISO 8601 timestamp of the latest transaction

**Option B — Simple Interest** `GET /accounts/:accountId/interest?rate=0.05&days=30`
- Calculates `principal × rate × (days / 365)` per currency
- Returns `balances`, `interest` (both per-currency maps), and `overdraftCurrencies` (currencies with negative balance, which earn 0 interest)
- `rate` must be a non-negative finite number; `days` must be a positive integer — validated with `Number()` and `isFinite()` (rejects strings like `0.05abc` or `Infinity`)

---

## Architecture

```
src/
├── index.js               # HTTP server entry point
├── app.js                 # Express setup, middleware, route mounting
├── store/
│   └── transactions.js    # In-memory array: findAll, findById, insert, filter
├── routes/
│   ├── transactions.js    # POST+GET /transactions, GET /transactions/:id
│   └── accounts.js        # GET /accounts/:accountId/balance|summary|interest
└── validators/
    └── transaction.js     # Joi schema + validate() middleware factory
```

**Key decisions:**
- Storage is a module-level singleton array — no database, resets on server restart
- Joi `when/switch` handles type-conditional account field requirements
- Account balance returns a `balances` map keyed by currency to avoid summing USD + EUR into one number

---

<div align="center">

*This project was completed as part of the AI-Assisted Development course.*

</div>
