# ✅ Homework 4 — 4-Agent Pipeline Checklist

Derived from [TASKS.md](./TASKS.md). Work top-to-bottom: build the sample app first (so the
pipeline has something to operate on), then the agents + skills, then orchestration, docs, and
submission.

> **Status (scaffold complete):** Phases 0–4 and 6 are done — sample app, 6 agent definitions, 2
> skills, the single-command orchestrator, and docs all exist and are verified (`npm install`,
> `tsc`, `npm test` pass; frontmatter parsing tested). **Remaining:** actually run the pipeline to
> generate the artifacts and apply fixes (Phase 5), capture screenshots (Phase 7), and submit
> (Phase 8).

> **Note on agents:** The 4 *required* agents are Bug Research Verifier, Bug Fixer, Security
> Verifier, and Unit Test Generator. The documented **run order** also references a *Bug Researcher*
> and *Bug Planner* — these produce the verifier/fixer inputs (`codebase-research.md`,
> `implementation-plan.md`). They are needed for the pipeline to run end-to-end, so they're tracked
> below as supporting agents.

> **Note on layout:** all three seeded issues are handled as one batch under a single run folder
> `context/bugs/001/` (its `bug-context.md` documents BUG-001, BUG-002, SEC-001), rather than one
> folder per bug.

---

## Phase 0 — Project Scaffold ✅

- [x] Create directory layout per TASKS.md "Expected Project Structure"
  - [x] `agents/`
  - [x] `skills/`
  - [x] `context/bugs/001/` (single batch folder for this run)
  - [x] `context/bugs/001/research/`
  - [x] `src/` (app source)
  - [x] `tests/`
  - [x] `docs/screenshots/`
  - [x] `demo/`
- [x] Decide tech stack — **Node.js + TypeScript + Jest** (Express)
- [x] Initialize project (`package.json`) with a test runner (`jest`) and run scripts (`dev`/`start`/`pipeline`)
- [x] Add `.gitignore` (excludes `node_modules/`, `dist/`, `coverage/`)

---

## Phase 1 — Task 5: Sample Mini Application ✅

**Folder**: `src/` (+ `tests/`) — Expense Tracker REST API

- [x] Choose scope small enough to fix in one pipeline run (small REST API)
- [x] Implement a runnable entry point (`npm run dev` → `http://localhost:3000`)
- [x] Wire up a test command (`npm test`, Jest + supertest — smoke test passes)
- [x] Seed **≥ 2 intentional bugs**
  - [x] BUG-001 — `maxAmount` string/number coercion in `src/store.ts`
  - [x] BUG-002 — missing 404 for unknown id in `src/app.ts`
- [x] Seed **≥ 1 intentional security issue** — SEC-001 `eval()` code injection in `src/app.ts`
- [x] Document each seeded issue in `context/bugs/001/bug-context.md` (symptom, location, expected vs actual)
- [x] Capture the **before** state (vulnerable/buggy code present; demo requests in `sample-requests.http`)
- [x] README documents run + test commands for the app

**Success criteria**: app runs locally; seeded bugs + security issue exist before pipeline and are
resolved after; tests pass post-fix; pipeline outputs reference real files in this app.

---

## Phase 2 — Skills ✅

### Task 1.2 — Research Quality Measurement skill
- [x] Create `skills/research-quality-measurement.md`
- [x] Define levels/labels for research quality (L0–L4: Unreliable → Verified)
- [x] Specify criteria for each level (reference resolution, snippet fidelity, claim support)
- [x] Define the required result-file format the verifier must emit

### Task 4.2 — FIRST skill
- [x] Create `skills/unit-tests-FIRST.md`
- [x] Define **F**ast, **I**ndependent, **R**epeatable, **S**elf-validating, **T**imely
- [x] Explain how each principle applies when generating tests
- [x] Ensure it's referenced from `unit-test-generator.agent.md`

---

## Phase 3 — Agents ✅ *(definitions authored; outputs generated in Phase 5)*

> Each agent declares an **explicit model** in frontmatter. Opus 4.8 → Researcher / Research
> Verifier / Security Verifier (deep reasoning); Sonnet 4.6 → Planner / Fixer / Test Generator
> (routine execution). Justified in the README.

### Supporting agents (needed for end-to-end run)
- [x] `agents/bug-researcher.agent.md` — produces `research/codebase-research.md` (file:line refs + snippets)
- [x] `agents/bug-planner.agent.md` — produces `implementation-plan.md` (files, before/after code, test command)

### Task 1 — Bug Research Verifier ⭐
**File**: `agents/research-verifier.agent.md`
- [x] Set role: fact-checker for Bug Researcher output
- [x] Reads `research/codebase-research.md`
- [x] Verifies every file:line reference resolves
- [x] Verifies snippets match source
- [x] Uses the **research-quality-measurement** skill
- [x] Declare explicit model in frontmatter (`claude-opus-4-8`)
- [x] Configured to create `research/verified-research.md` with required sections:
  - [x] Verification Summary (pass/fail, Research Quality per skill)
  - [x] Verified Claims
  - [x] Discrepancies Found
  - [x] Research Quality Assessment (level + reasoning)
  - [x] References
- [x] Output usable by Bug Planner

### Task 2 — Bug Fixer ⭐⭐
**File**: `agents/bug-fixer.agent.md`
- [x] Set role: executes implementation plan + documents changes
- [x] Reads `implementation-plan.md` fully (files, before/after, test command)
- [x] Applies changes per file as specified
- [x] Runs tests after each change; if fail → document and stop
- [x] Declare explicit model in frontmatter (`claude-sonnet-4-6`)
- [x] Configured to output `fix-summary.md` with:
  - [x] Changes Made (file, location, before/after, test result)
  - [x] Overall Status
  - [x] Manual Verification steps
  - [x] References

### Task 3 — Security Vulnerabilities Verifier ⭐⭐
**File**: `agents/security-verifier.agent.md`
- [x] Set role: security review of modified code (**report only — no code edits**)
- [x] Reads `fix-summary.md` + changed files
- [x] Scans for: injection, hardcoded secrets, insecure comparisons, missing validation, unsafe deps, XSS/CSRF where relevant
- [x] Rates findings CRITICAL / HIGH / MEDIUM / LOW / INFO
- [x] Declare explicit model in frontmatter (`claude-opus-4-8`)
- [x] Configured to output `security-report.md` where each finding has severity + file:line + remediation

### Task 4 — Unit Test Generator ⭐⭐⭐
**File**: `agents/unit-test-generator.agent.md`
- [x] Set role: generate + run unit tests for changed code only
- [x] Reads `fix-summary.md` + changed files
- [x] Generates tests for new/changed code only (not whole app)
- [x] Follows project test framework (Jest + supertest)
- [x] Uses the **unit-tests-FIRST** skill
- [x] Declare explicit model in frontmatter (`claude-sonnet-4-6`)
- [x] Configured to run tests and record results
- [x] Configured to output `test-report.md`
- [ ] Generated test files present under `tests/` *(produced when pipeline runs — Phase 5)*

---

## Phase 4 — Pipeline Orchestration ✅ *(single command)*

- [x] Create one entry point: `npm run pipeline` → `./run-pipeline.sh`
- [x] Starts all agents in correct order:
  - [x] Bug Researcher → Bug Research Verifier → Bug Planner → Bug Fixer → Security Verifier → Unit Test Generator
- [x] Loads each agent's related skills automatically (skill appended to system prompt by the runner)
- [x] No manual per-agent invocation between steps
- [ ] Verify a full clean run produces all output files end-to-end *(needs authenticated `claude` CLI — not yet run)*

---

## Phase 5 — Agent Outputs (artifacts committed to repo) ⬜ *(generated by running the pipeline)*

- [ ] `context/bugs/001/research/codebase-research.md`
- [ ] `context/bugs/001/research/verified-research.md`
- [ ] `context/bugs/001/implementation-plan.md`
- [ ] `context/bugs/001/fix-summary.md`
- [ ] `context/bugs/001/security-report.md`
- [ ] `context/bugs/001/test-report.md`
- [ ] All fixes applied to `src/` (working application)
- [ ] Generated unit tests in `tests/`

---

## Phase 6 — Documentation ✅

- [x] `README.md`
  - [x] Solution overview + features
  - [x] Architecture decisions
  - [x] AI tools used
  - [x] **Per-agent model choice + justification**
  - [x] How to run the pipeline (single command)
  - [x] How to run + test the app
  - [x] Author / student info (per root README requirement)
- [x] `HOWTORUN.md` — step-by-step run instructions
- [x] `demo/run.sh` — script to start the app
- [x] `demo/sample-requests.http` — sample API calls (incl. buggy/vulnerable cases)

---

## Phase 7 — Screenshots (`docs/screenshots/`) ⬜

- [ ] Pipeline run (single command executing all agents)
- [ ] Fixes applied (before/after or diff)
- [ ] Security scan output
- [ ] Unit tests generated + passing
- [ ] AI interaction screenshots

---

## Phase 8 — Submission ⬜

- [x] Branch `homework-4-submission` (currently checked out)
- [ ] Commit agentic folder (`agents/`, `skills/`, `context/`, artifacts) to repo
- [ ] Push branch to fork
- [ ] Open PR into `main` on the fork (NOT upstream)
- [ ] PR body includes: detailed description, AI tools used, challenges encountered, screenshots
- [ ] Verify against grading weights:
  - [ ] Functionality 30%
  - [ ] AI Usage Documentation 25%
  - [ ] Code Quality 20%
  - [ ] Documentation 15%
  - [ ] Demo & Screenshots 10%

---

## ⚠️ Open Questions / Decisions

- [x] Tech stack for the sample app — **resolved: Node.js + TypeScript + Jest, Express REST API**
- [x] How agents are invoked by the single command — **resolved: shell script (`run-pipeline.sh`)
      driving `claude -p` headless, per-agent model from frontmatter, skills auto-appended**
- [x] Noted: TASKS.md "Expected Project Structure" mislabels the dir `homework-5/` — using `homework-4/`
- [x] Permission mode for the run — **resolved: unattended.** `run-pipeline.sh` uses
      `--dangerously-skip-permissions` so agents can edit files and run `npm test` without prompting.
