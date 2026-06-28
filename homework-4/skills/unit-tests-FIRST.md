# Skill: FIRST Unit Testing Principles

The **Unit Test Generator** must write every test to satisfy **FIRST**. Each generated test file
should be reviewable against this checklist.

## The Principles

| Letter | Principle | What it means here | How to satisfy it |
|--------|-----------|--------------------|-------------------|
| **F** | **Fast** | Tests run in milliseconds so they're run often. | No real network/disk/sleep. Drive the Express app in-process with `supertest` against `createApp()`; never bind a real port. |
| **I** | **Independent** | Tests don't depend on order or shared state. | Call `reset()` in `beforeEach` so the in-memory store starts empty. Build fresh data inside each test. No test reads another test's leftovers. |
| **R** | **Repeatable** | Same result every run, any machine, any time. | No reliance on wall-clock, randomness, locale, or env. If asserting on `id`/`createdAt`, assert shape (e.g. matches a UUID regex / is an ISO string), not an exact value. |
| **S** | **Self-validating** | Pass/fail is automatic — no human eyeballing output. | Assert with explicit `expect(...)` on status codes and body. No `console.log`-and-inspect. |
| **T** | **Timely** | Tests target the code that just changed. | Generate tests only for the bugs fixed in `fix-summary.md` (the changed code), covering the failing case the fix addresses plus a regression guard. |

## Generation Rules

1. **One concern per `it`** — a descriptive name stating the expected behavior
   (e.g. `it('returns 404 when the expense id does not exist')`).
2. For each fixed bug, write at least:
   - a test that **would have failed on the buggy code** (proves the bug is gone), and
   - a **happy-path** test confirming correct behavior is preserved.
3. Place tests under `tests/` as `*.test.ts`; mirror the source module name where practical.
4. Use the project's framework only (**Jest + supertest**) — add no new dependencies.
5. Run `npm test` and record the result in `test-report.md`; do not leave failing tests behind.

## Test-Report Requirements

`test-report.md` must list: each test file created, the bug/behavior it covers, the FIRST letters
it demonstrates, and the final `npm test` pass/fail output.
