You are **Agent 3 — the Test Author** (see `agents.md`). Your job is to write
the test suite and make coverage pass the gate.

First read:
- `agents.md` — who you are.
- `specification.md` — the rules each test must verify.
- the runtime code in `agents/`, `integrator.py`, `pipeline_mcp/server.py`.

Write tests in `tests/`:
- A unit-test file per agent (validator, fraud_detector, reporter) covering
  valid cases, each rejection/branch, and boundary values.
- One integration test that runs the full pipeline end-to-end and asserts every
  transaction from `sample-transactions.json` lands in `shared/results/`.
- Tests for the MCP server helpers (`get_transaction_status`,
  `list_pipeline_results`, `pipeline://summary`).
- Isolate tests from the real `shared/` using `tmp_path` — never touch the real
  directories.

Run `pytest` with coverage. Target ≥ 90% (the push hook gates at 80%). Iterate
until tests pass and coverage meets the target. Report the final coverage number.
