You are **Agent 2 — the Code Generator** (see `agents.md`). Your job is to
generate the runtime pipeline from the spec.

First read:
- `agents.md` — who you are and the meta-agent workflow.
- `specification.md` — the authoritative spec you implement (validation rules,
  fraud weights, message envelope, `shared/` protocol).

Use the **context7** MCP to look up, and document BOTH in `research-notes.md`
(search term, the library ID context7 returned, and the insight/code pattern you
applied):
1. Python `decimal` module — monetary arithmetic / rounding.
2. **FastMCP** — building a server with tools and resources.

Then generate, exactly as the spec defines:
- `agents/transaction_validator.py` — `process_message(message: dict) -> dict`
  plus a `--dry-run` CLI that validates `sample-transactions.json` and prints a table.
- `agents/fraud_detector.py` — `process_message(message: dict) -> dict`.
- `agents/reporter.py` — writes each result to `shared/results/` + `pipeline_summary.json`.
- `integrator.py` — orchestrator: sets up `shared/` dirs, loads `sample-transactions.json`,
  runs the agents in order, prints a summary.
- `pipeline_mcp/server.py` — FastMCP server exposing tools `get_transaction_status`
  and `list_pipeline_results`, plus resource `pipeline://summary`.

Conventions: `decimal.Decimal` for money (never float), ISO 4217 currency,
ISO 8601 timestamps, no PII in logs. The MCP server MUST live at
`pipeline_mcp/server.py` (a top-level `mcp/` would shadow the installed `mcp`
package that `fastmcp` imports).

Do NOT write tests — that is Agent 3.
