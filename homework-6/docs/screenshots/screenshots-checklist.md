# Screenshot Checklist (HW6)

Capture during Phase B, in this order. Save each into this folder
(`homework-6/docs/screenshots/`) with the EXACT filename, then embed all of them
in the PR description (the rubric checks both the folder and the PR).

## Required (5) + spec-produced extra

| ✅ | File | Capture WHEN | How |
|----|------|--------------|-----|
| [ ] | `spec-produced.png` *(PR-desc extra)* | running **`/write-spec`** (Agent 1) | the command generating `specification.md` |
| [ ] | `mcp-interaction.png` *(half 1: context7)* | during **`/generate-pipeline`** (Agent 2) | the **context7** query result while looking up `decimal` / FastMCP — ⚠️ ephemeral, grab it live |
| [ ] | `test-coverage.png` | after **`/write-tests`** (Agent 3) | `pytest` output showing coverage ≥ 90% |
| [ ] | `hook-trigger.png` | after tests exist | **force a fail** (e.g. set `--cov-fail-under=100`), attempt `git push`, capture the block, then restore |
| [ ] | `pipeline-run.png` | demo | full `python integrator.py` terminal output |
| [ ] | `skill-run-pipeline.png` | demo | **`/run-pipeline`** executing |
| [ ] | `mcp-interaction.png` *(half 2: custom tool)* | **after** the pipeline run | call `get_transaction_status` / `list_pipeline_results` via the MCP server |

## Two gotchas

- **`mcp-interaction.png` spans two moments.** context7 half = during code gen (capture live, can't easily redo). Custom-tool half = after `shared/results/` is populated. One composite image or two images both fine, as long as context7 AND a custom MCP tool call are visible.
- **`hook-trigger.png` won't happen by accident.** At ≥90% the gate passes silently — you must force a failure to see it block, then revert.

## Rule of thumb

- AI workflow in the act (`/write-spec`, context7, `/run-pipeline`, hook firing) → **capture the moment it happens.**
- Static result (coverage report, pipeline summary, MCP output) → reproducible later by re-running.

## PR description

Embed/link: spec produced · pipeline run · tests/coverage · skill + hook · MCP usage · README (with author name).
