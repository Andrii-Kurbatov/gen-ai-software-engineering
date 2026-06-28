# HOWTORUN.md — AI-Powered Multi-Agent Banking Pipeline

## Prerequisites

- Python 3.11+
- Node.js / `npx` (only needed to run the context7 MCP server)
- Git (for the push hook to fire)

---

## 1. Clone and enter the directory

```bash
git clone <your-fork-url>
cd homework-6
```

---

## 2. Create a virtual environment and install dependencies

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## 3. Run the pipeline

```bash
python integrator.py
```

This will:
- Create `shared/input/`, `shared/processing/`, `shared/output/`, and `shared/results/` if they do not exist.
- Load all 8 transactions from `sample-transactions.json`.
- Route each transaction through validator → fraud detector → reporter.
- Write individual result files to `shared/results/TXN001.json` … `TXN008.json`.
- Write `shared/results/pipeline_summary.json` and `shared/results/pipeline.log`.
- Print a summary table to stdout.

You can also pass a custom transactions file:

```bash
python integrator.py path/to/custom-transactions.json
```

---

## 4. Run tests and check coverage

```bash
pytest
```

pytest is configured in `pytest.ini` to measure coverage across `agents/`,
`integrator.py`, and `pipeline_mcp/` and to print a `--cov-report=term-missing`
summary. Coverage must be ≥ 80% to pass the push hook (see step 7).

To run a specific test file:

```bash
pytest tests/test_validator.py -v
```

---

## 5. Run the MCP server

The custom FastMCP server lives at `pipeline_mcp/server.py` (not `mcp/server.py`,
to avoid shadowing the installed `mcp` package).

```bash
python pipeline_mcp/server.py
```

The server exposes:
- **Tool** `get_transaction_status(transaction_id)` — returns the full result envelope for a single transaction.
- **Tool** `list_pipeline_results()` — returns a summary list of all processed transactions.
- **Resource** `pipeline://summary` — returns the content of `shared/results/pipeline_summary.json`.

> Run `python integrator.py` first so `shared/results/` is populated before
> querying the MCP server.

---

## 6. Use the slash commands (Claude Code)

The following slash commands are registered in `.claude/commands/`:

| Command | What it does |
|---|---|
| `/run-pipeline` | Checks for `sample-transactions.json`, clears `shared/`, runs `integrator.py`, shows results summary, reports rejections. |
| `/validate-transactions` | Runs the validator in dry-run mode (`python agents/transaction_validator.py --dry-run`), reports total / valid / invalid counts and rejection reasons in a table. |
| `/write-spec` | Agent 1: produces `specification.md` from the template. |
| `/generate-pipeline` | Agent 2: generates the pipeline code using context7 for library lookups. |
| `/write-tests` | Agent 3: writes `tests/` with ≥ 80% coverage. |
| `/write-docs` | Agent 4: generates `README.md` and `HOWTORUN.md`. |

Invoke any of them inside Claude Code:

```
/run-pipeline
```

---

## 7. Coverage gate hook

A pre-push hook is configured in `.claude/settings.json`. It runs
`.claude/coverage_gate.py` before any `Bash` tool call that attempts a
`git push`. If test coverage is below 80%, the push is blocked with an error
message.

To trigger it manually (simulate what the hook does):

```bash
python .claude/coverage_gate.py
```

---

## 8. MCP configuration (both servers)

Both MCP servers are registered in `mcp.json` at the project root:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "pipeline-status": {
      "command": "python",
      "args": ["pipeline_mcp/server.py"]
    }
  }
}
```

Claude Code picks this file up automatically when you open the `homework-6/`
directory. The `context7` server requires `npx` to be available on your `PATH`.

---

## 9. Sample output

After `python integrator.py` the terminal shows:

```
[2026-06-23T10:00:00Z] [integrator] loaded 8 transactions
...
========================================================================
TXN ID      STATUS        RISK      SCORE   FLAGS
------------------------------------------------------------------------
TXN001      complete      LOW       0       —
TXN002      complete      MEDIUM    40      high_value: $25000.00 >= $10000
TXN003      complete      LOW       25      structuring: $9999.99 in [9000,10000)
TXN004      complete      MEDIUM    40      off_hours: 02:47 UTC; cross_border: EUR; api_channel
TXN005      complete      HIGH      70      high_value: $75000.00 >= $50000
TXN006      rejected      N/A       —       —
TXN007      rejected      N/A       —       —
TXN008      complete      LOW       0       —
========================================================================
Total: 8  Valid: 6  Rejected: 2  HIGH: 1  MEDIUM: 2  LOW: 3
```

Results land in `shared/results/`:

```
shared/results/
├── TXN001.json … TXN008.json   ← per-transaction envelopes
├── pipeline_summary.json        ← aggregate report
└── pipeline.log                 ← full audit log (PII-masked)
```
