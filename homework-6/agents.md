# agents.md — HW6 Multi-Agent Banking Pipeline

Context for the **AI agents** (the meta-agents) that build and operate this
project. **Every slash command reads this file first.**

## Project

A file-based transaction pipeline: raw records from `sample-transactions.json`
are processed by three services (validator → fraud detector → reporter) into
JSON results in `shared/results/`. The system is produced and operated by the
four meta-agents below.

## Meta-agents

| Agent | Role | Input | Output | Command |
|-------|------|-------|--------|---------|
| 1 — Spec Writer | Produce the technical spec | `TASKS.md` + `sample-transactions.json` | `specification.md` | `/write-spec` |
| 2 — Code Generator | Generate the runtime pipeline (uses **context7**) | `specification.md` | `integrator.py`, `agents/*.py`, `pipeline_mcp/server.py`, `research-notes.md` | `/generate-pipeline` |
| 3 — Test Author | Write tests; coverage gated at 80% by the push hook | runtime code | `tests/*` | `/write-tests` |
| 4 — Doc Writer | Generate docs | finished system | `README.md`, `HOWTORUN.md` | `/write-docs` |

Each command opens with "You are Agent N" and reads this file, so it knows its role.

## Workflow

Run the meta-agents in order: `/write-spec` → `/generate-pipeline` → `/write-tests`
→ `/write-docs`. Then demo the finished system with the operational commands
`/run-pipeline` and `/validate-transactions`.

## Runtime contract — see `specification.md`

The message envelope, the `shared/` directory protocol, the money / currency /
timestamp / PII conventions, and the validation + fraud-scoring rules are part
of the system *specification*. They are defined in `specification.md` (Agent 1's
output) and implemented by Agent 2 — intentionally not duplicated here.
