#!/usr/bin/env bash
#
# run-pipeline.sh — single-command runner for the HW4 4-agent pipeline.
#
# It drives each agent in the documented order using Claude Code headless mode
# (`claude -p`). For every stage it:
#   1. reads the model from the agent file's frontmatter (`model:`),
#   2. uses the agent file body as the system prompt,
#   3. auto-loads that agent's related skill (appended to the system prompt),
#   4. passes a concrete task instruction.
#
# Order: Bug Researcher -> Research Verifier -> Bug Planner -> Bug Fixer
#        -> Security Verifier -> Unit Test Generator
#
# Usage:  ./run-pipeline.sh            (or: npm run pipeline)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

AGENTS="$ROOT/agents"
SKILLS="$ROOT/skills"
BUG_DIR="context/bugs/001"

# Fully unattended: agents may edit files AND run commands (e.g. `npm test`)
# without prompting. This is required because the Bug Fixer and Unit Test
# Generator run the test suite mid-stage. Safe here because the pipeline runs
# inside this homework repo — review the resulting diff before committing.
PERMISSION_FLAG="--dangerously-skip-permissions"

command -v claude >/dev/null 2>&1 || {
  echo "ERROR: the 'claude' CLI is not on PATH. Install Claude Code first." >&2
  exit 1
}

# --- frontmatter helpers ----------------------------------------------------

# Print the value of the `model:` key from a file's YAML frontmatter.
get_model() {
  awk -F': *' '/^model:/{gsub(/[[:space:]]+$/,"",$2); print $2; exit}' "$1"
}

# Print the file body with the leading YAML frontmatter (--- ... ---) removed.
strip_frontmatter() {
  awk 'BEGIN{fm=0} /^---[[:space:]]*$/{fm++; next} fm>=2{print}' "$1"
}

# --- agent runner -----------------------------------------------------------
#
# run_agent <agent-file> <task-instruction> [skill-file]
run_agent() {
  local agent_file="$1"
  local task="$2"
  local skill_file="${3:-}"

  local model system_prompt
  model="$(get_model "$agent_file")"
  system_prompt="$(strip_frontmatter "$agent_file")"

  if [[ -n "$skill_file" && -f "$skill_file" ]]; then
    system_prompt+=$'\n\n## Loaded skill\n\n'"$(cat "$skill_file")"
    echo "   skill: $(basename "$skill_file")"
  fi

  echo "▶ $(basename "$agent_file")  (model: ${model})"
  claude -p "$task" \
    --model "$model" \
    --append-system-prompt "$system_prompt" \
    $PERMISSION_FLAG
  echo "✓ done: $(basename "$agent_file")"
  echo
}

echo "=============================================="
echo " HW4 — 4-Agent Pipeline"
echo " bug dir: $BUG_DIR"
echo "=============================================="
echo

# Stage 1 — Bug Researcher
run_agent "$AGENTS/bug-researcher.agent.md" \
  "Read $BUG_DIR/bug-context.md and the source under src/. Produce $BUG_DIR/research/codebase-research.md documenting BUG-001, BUG-002 and SEC-001 with exact file:line references and verbatim source snippets."

# Stage 2 — Bug Research Verifier  (loads research-quality-measurement skill)
run_agent "$AGENTS/research-verifier.agent.md" \
  "Read $BUG_DIR/research/codebase-research.md and verify every reference and snippet against src/. Write $BUG_DIR/research/verified-research.md using the loaded research-quality-measurement skill." \
  "$SKILLS/research-quality-measurement.md"

# Stage 3 — Bug Planner
run_agent "$AGENTS/bug-planner.agent.md" \
  "Read $BUG_DIR/research/verified-research.md and produce $BUG_DIR/implementation-plan.md with per-file before/after code and the npm test command."

# Stage 4 — Bug Fixer
run_agent "$AGENTS/bug-fixer.agent.md" \
  "Read $BUG_DIR/implementation-plan.md, apply every change to src/, run 'npm test', and write $BUG_DIR/fix-summary.md (include a Changed Files list)."

# Stage 5 — Security Verifier
run_agent "$AGENTS/security-verifier.agent.md" \
  "Read $BUG_DIR/fix-summary.md and the changed files it lists. Write $BUG_DIR/security-report.md with severity-rated findings. Report only — do not edit code."

# Stage 6 — Unit Test Generator  (loads unit-tests-FIRST skill)
run_agent "$AGENTS/unit-test-generator.agent.md" \
  "Read $BUG_DIR/fix-summary.md and the changed files it lists. Generate Jest tests under tests/ for the changed code only, run 'npm test', and write $BUG_DIR/test-report.md using the loaded FIRST skill." \
  "$SKILLS/unit-tests-FIRST.md"

echo "=============================================="
echo " Pipeline complete. Artifacts in $BUG_DIR/"
echo "=============================================="
