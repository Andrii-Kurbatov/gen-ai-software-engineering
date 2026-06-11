# How Models Were Used — Homework 2

Each section below is written by the model it describes.

| Model | Role |
|-------|------|
| Claude Sonnet 4.6 | Architect — technology decisions, documentation, implementation checklist, fix documents |
| Codex | Reviewer — audited implementation against specs, ran tests, produced findings |
| Claude Haiku 4.5 | Implementer — wrote all source code and tests from the checklist, applied fix documents |

---

## Claude Sonnet 4.6

### Phase 1 — Technology & Architecture

**Communication style:** conversational Q&A.

I asked open-ended questions to work through decisions one at a time:
- "What frameworks should I use?"
- "Will TypeScript work where the task says JavaScript?"
- "What are the tradeoffs of SQLite vs LowDB?"
- "For schema validation with TS — is Zod a go-to?"

Claude answered each, I pushed back or asked follow-ups, and we landed on a
stack together. Once decided, I gave direct creation requests ("create
ARCHITECTURE.md", "create API_REFERENCE.md") and refined the output inline
("remove winston", "remove C4 diagrams", "remove Zod as a separate node").

**Artifacts produced:** `docs/ARCHITECTURE.md`, `docs/API_REFERENCE.md`,
`docs/adr/ADR-001-technology-choices.md`, `docs/IMPLEMENTATION_CHECKLIST.md`

### Phase 2 — Reviewing Codex Output

**Communication style:** paste review findings, get a fix document back.

After Codex implemented the source files, I ran its own review tool and pasted
the findings into the chat: "here're results of codex review, check them, plan
changes in new md". Claude read the findings, cross-referenced the actual source
files, assessed severity, and produced a structured markdown fix document for
each service layer (before/after code, explanation of the problem).

I repeated this for three rounds of review findings (classification service,
ticket service, import service, then routes/app/repository).

**Artifacts produced:** `docs/ROUTES_APP_FIXES.md` (current remaining fixes);
earlier fix docs were applied and deleted.

### Phase 3 — Maintenance & Housekeeping

**Communication style:** short direct commands.

- "delete unreasonable mds with done fixes, check if checklist is up-to-date"
- "check if all other steps implemented, update checklist"
- "create md with fixes for haiku" (after pasting new review findings)

Each command was a single sentence. Claude inferred scope, checked the relevant
files, and acted.

### Tools and Modes Used

| Tool / mode | When |
|-------------|------|
| Conversational Q&A | Technology selection, architecture decisions |
| `/plan` mode | Document structure decisions (e.g. this file) |
| Paste-and-delegate | Providing Codex review output for Claude to analyze |
| Inline feedback | Refining generated docs without re-prompting from scratch |
| One-line commands | Housekeeping tasks (delete files, update checklist) |

---

## Codex

### Phase 1 — Step-by-Step Implementation Review

**Communication style:** direct review requests with explicit source documents.

I gave Codex a senior-engineer review role and pointed it at the project scope:
`homework-2` implementation, `homework-2/claude.md` for context,
`homework-2/TASKS.md` for requirements, and
`homework-2/docs/IMPLEMENTATION_CHECKLIST.md` for the intended build order.

The prompts were short but structured:
- "review implementation of Step 1"
- "check implementation of step2"
- "check step 3"

Codex read the checklist section, inspected the corresponding source files, ran
build/tests where relevant, and returned findings ordered by severity with file
and line references. The interaction was mostly conversational review: I asked
for one step at a time, Codex reported concrete mismatches, and those findings
were then used as input for later fix passes.

**Artifacts produced:** review findings for `classification.service.ts`,
`ticket.service.ts`, and `import.service.ts`; no source code was changed in
these review-only passes.

### Phase 2 — Whole-Project Adherence Review

**Communication style:** broad audit request, same requirements as source of truth.

After the individual service reviews, I asked Codex to check the whole
implementation against `TASKS.md`, `ARCHITECTURE.md`, and `API_REFERENCE.md`.
Codex inspected routes, controllers, services, repository, schemas, tests,
fixtures, documentation, and deliverables. It ran `npm run build`,
`npm test -- --runInBand`, and `npm run test:coverage -- --runInBand` to verify
actual behavior rather than relying only on static inspection.

When I later said "recheck now", Codex repeated the same audit against the
updated tree and reported which previous issues were fixed and which remained.

**Artifacts produced:** whole-project review findings, verification summaries,
and remaining-gaps list for coverage, screenshots, sample-data locations, and
architecture/API alignment.

### Tools and Modes Used

| Tool / mode | When |
|-------------|------|
| Senior-engineer review | Checking implementation quality and requirement adherence |
| Step-by-step review | Reviewing Steps 1, 2, and 3 against the checklist |
| Whole-project audit | Checking implementation against TASKS, ARCHITECTURE, and API docs |
| Terminal inspection | Reading source/docs with `rg`, `nl`, and related shell commands |
| Verification runs | Running build, tests, and coverage to confirm behavior |
| Conversational recheck | Re-running the audit after fixes were applied |

---

## Claude Haiku 4.5

The primary input was the `docs/` directory — `docs/IMPLEMENTATION_CHECKLIST.md`
drove the bulk of the work, and `docs/ROUTES_APP_FIXES.md` drove the fix pass.
Most interactions were short commands that pointed at a doc rather than
describing the task inline.

### Phase 1 — Implementation Checklist (Steps 1–6, old revision)

**Communication style:** "do step N" pointing at the checklist.

Haiku worked from an earlier revision of `docs/IMPLEMENTATION_CHECKLIST.md`
that covered the full project in Steps 1–6 — all source files, services,
controllers, repository, routes, tests, fixtures, README, and TESTING_GUIDE.
Commands were short ("do step 1", "do step 6") because the checklist contained
all the detail: exact type signatures, keyword sets, SQL, test counts per file.
When tests failed, I sent one-line corrections ("fix import path — runMigrations
is in migrations.ts, not database.ts"). When coverage fell below 85%, Haiku
added targeted tests until it passed.

**Artifacts produced:** all `src/` files, 8 test files, 7 fixture files,
`README.md`, `docs/TESTING_GUIDE.md`

### Phase 2 — Fix Document (ROUTES_APP_FIXES.md)

**Communication style:** single command, structured doc as the real prompt.

"implement fixes from @docs/ROUTES_APP_FIXES.md" — the fix document contained
all context (before/after code, severity, files to touch), so no further
explanation was needed. Haiku applied all 8 fixes in order, adjusted affected
tests, and added coverage tests when branch coverage dipped after the dynamic
SQL rewrite.

**Artifacts produced:** modified `app.ts`, `tickets.routes.ts`,
`tickets.controller.ts`, `ticket.repository.ts`, `classification.service.ts`,
`API_REFERENCE.md`, `ARCHITECTURE.md`

### Tools and Modes Used

| Tool / mode | When |
|-------------|------|
| Checklist-driven commands | "do step N" — all Steps 6–9 |
| Fix-doc-driven commands | "implement fixes from @doc" |
| One-line error corrections | Fixing failing tests mid-session |
| Coverage-driven iteration | Adding tests to hit uncovered branches |
