# AI-Powered Multi-Agent Banking Pipeline

**Created by Andrii Kurbatov**

## What It Does

This project is a file-based banking transaction processing pipeline built as a
capstone for the *GenAI and Agentic AI for Software Engineering* course. Raw
transaction records from `sample-transactions.json` are routed through three
cooperating runtime agents — a validator, a fraud detector, and a reporter —
each communicating via JSON files in a shared directory. The integrator
orchestrates the flow and prints a summary table when the run completes.

Every transaction, regardless of outcome, lands in `shared/results/` as a
structured JSON file containing the full message envelope, agent verdicts, risk
scores, and (for rejected transactions) validation error reasons. An aggregate
`pipeline_summary.json` and an `pipeline.log` audit trail are produced at the
end of each run. The system is queryable via a custom FastMCP server and is
built end-to-end by four meta-agents (Claude Code slash commands).

---

## Agent Responsibilities

### Meta-agents (AI slash commands that build the system)

- **Agent 1 — Spec Writer** (`/write-spec`): reads `TASKS.md` and
  `sample-transactions.json`, then produces `specification.md` — the canonical
  source of truth for all validation rules, fraud-scoring logic, file-protocol
  conventions, and PII-handling requirements.
- **Agent 2 — Code Generator** (`/generate-pipeline`): consumes
  `specification.md`, queries context7 for library documentation, and generates
  `integrator.py`, all `agents/*.py` modules, and `pipeline_mcp/server.py`.
  Documents 2+ context7 queries in `research-notes.md`.
- **Agent 3 — Test Author** (`/write-tests`): writes `tests/` covering each
  agent individually plus an end-to-end integration path; a push hook blocks
  commits if line coverage falls below 80%.
- **Agent 4 — Doc Writer** (`/write-docs`): produces this `README.md` and
  `HOWTORUN.md` from the finished system.

### Runtime services (produced by Agent 2)

- **Transaction Validator** (`agents/transaction_validator.py`): checks required
  fields, amount precision and sign, ISO 4217 currency codes, `ACC-XXXX` account
  format, and ISO 8601 timestamps; routes invalid transactions directly to the
  reporter.
- **Fraud Detector** (`agents/fraud_detector.py`): scores each validated
  transaction 0–100 across five additive rules (high-value amount, structuring
  pattern, off-hours timestamp, cross-border currency, automated API channel);
  assigns a `LOW`/`MEDIUM`/`HIGH` risk level.
- **Reporter** (`agents/reporter.py`): writes per-transaction result JSON to
  `shared/results/`, appends to `pipeline.log` with PII-masked account numbers,
  and generates `pipeline_summary.json` after all transactions are processed.

---

## Architecture

```
sample-transactions.json
         │
         ▼
  ┌─────────────┐
  │  integrator │  (wraps each record in a message envelope)
  └──────┬──────┘
         │  shared/input/<TXN>.json
         ▼
  ┌──────────────────────┐
  │ transaction_validator│  validates fields, amount, currency, account format
  └──────────┬───────────┘
             │ valid?
      ┌──────┴──────┐
     YES            NO
      │              │ (target_agent = reporter)
      ▼              │
  ┌────────────┐     │
  │fraud_detector    │  scores risk 0–100; sets risk_level + risk_flags
  └─────┬──────┘     │
        │            │
        └─────┬──────┘
              ▼
        ┌──────────┐
        │ reporter │  writes shared/results/<TXN>.json
        └──────────┘          + pipeline.log
                              + pipeline_summary.json

  FastMCP server (pipeline_mcp/server.py)
  ├─ tool  get_transaction_status(transaction_id)
  ├─ tool  list_pipeline_results()
  └─ resource  pipeline://summary
```

> **Note on the MCP server path.** The assignment lists `mcp/server.py`, but this
> project places it at **`pipeline_mcp/server.py`**. A top-level `mcp/` package
> shadows the installed `mcp` package that `fastmcp` imports, which breaks the
> server and the test suite under `pytest`. `pipeline_mcp/` avoids the collision;
> `mcp.json` and `.mcp.json` both point to it. Functionality is identical.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Pipeline framework | Standard library (`pathlib`, `json`, `uuid`, `decimal`, `datetime`) |
| MCP server | [FastMCP](https://github.com/jlowin/fastmcp) ≥ 2.0 |
| Context7 MCP | `@upstash/context7-mcp` (via `npx`) |
| Testing | pytest + pytest-cov |
| Coverage gate | Pre-push hook via `.claude/settings.json` + `.claude/coverage_gate.py` |
| Monetary arithmetic | `decimal.Decimal` with `ROUND_HALF_UP` |
| Currency validation | ISO 4217 alphabetic code set (hardcoded, ~170 active codes) |
| Message transport | File-based JSON envelopes in `shared/` directories |
