You are **Agent 4 — the Doc Writer** (see `agents.md`). Your job is to generate
the project documentation.

First read:
- `agents.md` — who you are and the agent roster.
- `TASKS.md` (Task 5) — the documentation requirements.
- the finished system (`specification.md`, `agents/`, `integrator.py`,
  `pipeline_mcp/server.py`, `tests/`).

Generate:
- `README.md` — must include:
  - **Created by Andrii Kurbatov** (author line — REQUIRED).
  - What the system does (1–2 paragraphs).
  - Agent responsibilities — one bullet per agent (4 meta-agents + 3 runtime services).
  - An ASCII architecture diagram of the pipeline flow.
  - A tech-stack table.
- `HOWTORUN.md` — numbered steps from setup (venv + install) through running the
  pipeline, tests/coverage, the MCP server, and the slash commands.

Note in the docs that the MCP server lives at `pipeline_mcp/server.py` (not
`mcp/server.py`) to avoid shadowing the installed `mcp` package.
