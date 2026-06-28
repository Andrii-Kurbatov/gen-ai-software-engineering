# HOWTORUN — Homework 4

## Prerequisites

- **Node.js** ≥ 18 and npm
- **Claude Code CLI** (`claude`) on your PATH and authenticated — required only to run the agent
  pipeline (`npm run pipeline`). Running and testing the sample app does **not** need it.

Verify:

```bash
node -v
claude --version    # only needed for the pipeline
```

## 1. Install dependencies

```bash
cd homework-4
npm install
```

## 2. Run the sample app (the "before" state)

```bash
npm run dev          # starts http://localhost:3000
```

In another terminal, exercise the seeded issues (or use `demo/sample-requests.http`):

```bash
# BUG-002: returns 200 + empty body instead of 404
curl -i http://localhost:3000/expenses/does-not-exist

# SEC-001: user input reaches eval() (code injection) — benign demo
curl "http://localhost:3000/expenses/filter?expr=e.amount>0"
```

Run the test suite (the smoke test passes before the pipeline):

```bash
npm test
```

## 3. Run the 4-agent pipeline (single command)

```bash
npm run pipeline
# equivalently:
./run-pipeline.sh
```

This runs, in order: Bug Researcher → Research Verifier → Bug Planner → Bug Fixer → Security
Verifier → Unit Test Generator. Each stage uses its own model (from agent frontmatter) and
auto-loads its skill. Artifacts are written to `context/bugs/001/`.

> The pipeline runs Claude Code with `--dangerously-skip-permissions` so it can apply fixes, write
> tests, and run `npm test` fully unattended. This is safe because it runs inside this homework repo;
> review the resulting diff before committing.

## 4. Verify the "after" state

```bash
npm test             # generated unit tests + smoke test should pass

# BUG-002 now returns 404
curl -i http://localhost:3000/expenses/does-not-exist

# SEC-001 endpoint no longer evaluates arbitrary code
```

Inspect the generated artifacts:

```
context/bugs/001/research/codebase-research.md
context/bugs/001/research/verified-research.md
context/bugs/001/implementation-plan.md
context/bugs/001/fix-summary.md
context/bugs/001/security-report.md
context/bugs/001/test-report.md
```

## Troubleshooting

- **`claude: command not found`** — install/authenticate Claude Code; the pipeline needs it (the app
  itself does not).
- **Port in use** — set a different port: `PORT=4000 npm run dev`.
- **Re-running the pipeline** — git-stash or revert `src/` to the seeded state first if you want a
  clean before/after demo: `git checkout -- src/ tests/`.
