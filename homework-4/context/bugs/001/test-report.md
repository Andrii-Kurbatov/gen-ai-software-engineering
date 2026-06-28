# Test Report — Bug Fix 001 (Expense Tracker API)

## Test Files Created

### `tests/bugs-001.test.ts`

Covers all three fixes from `fix-summary.md`.

| Describe block | Bug / Behavior | Tests | FIRST |
|---|---|---|---|
| `GET /expenses?maxAmount=` | BUG-001 — string-vs-number coercion in `listExpenses` | 4 | F I R S T |
| `GET /expenses/:id` | BUG-002 — missing 404 on unknown id in `getExpense` handler | 2 | F I R S T |
| `GET /expenses/filter` | SEC-001 — `eval()` injection removed, safe structured params | 3 | F I R S T |

**FIRST checklist per suite:**

- **F (Fast):** All tests run in-process via `supertest` against `createApp()` — no network I/O, no real port binding.
- **I (Independent):** `reset()` is called in `beforeEach`; every test builds its own fixture data.
- **R (Repeatable):** No wall-clock, randomness, or env dependency; UUID / `createdAt` are not asserted by exact value.
- **S (Self-validating):** Every test ends with explicit `expect(...)` assertions on status codes and body shapes.
- **T (Timely):** Tests target only the three changed behaviours documented in `fix-summary.md`.

---

## Coverage Notes

| Changed location | Test(s) that exercise it |
|---|---|
| `src/store.ts:30-35` — `parseFloat` + `isNaN` guard | `excludes expenses whose amount exceeds the numeric maxAmount`, `includes expenses whose amount equals maxAmount (boundary)`, `returns all expenses when maxAmount is not a valid number (no-op)` |
| `src/app.ts:29-36` — 404 guard on `GET /expenses/:id` | `returns 404 with error body when the expense id does not exist`, `returns 200 with the expense object when the id exists (happy path)` |
| `src/app.ts:23-27` — `eval()` replaced with structured params | `does not execute arbitrary code passed as expr param`, `filters by category via safe structured params`, `filters by maxAmount via safe structured params` |

---

## Result

```
> expense-tracker-api@1.0.0 test
> jest

PASS tests/bugs-001.test.ts
PASS tests/health.test.ts

Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        0.825 s, estimated 1 s
Ran all test suites.
```

**All 10 tests pass.**

---

## References

- Fix summary: `context/bugs/001/fix-summary.md`
- Changed files: `src/store.ts`, `src/app.ts`
- Existing baseline: `tests/health.test.ts`
