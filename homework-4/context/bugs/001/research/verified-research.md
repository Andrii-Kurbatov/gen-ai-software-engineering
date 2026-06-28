# Verified Research — Run 001 (Expense Tracker API)

Stage: **Bug Research Verifier** (fact-check & grade — no fixes, no planning).
Source of record: `src/store.ts`, `src/app.ts`, `src/types.ts` (the files containing every
referenced line). Verified against the research at `context/bugs/001/research/codebase-research.md`.

---

## 1. Verification Summary

- **Verdict:** ✅ **PASS**
- **Research Quality:** **L4 — ✅ Verified**
- **Metrics:**
  | Metric | Value | Detail |
  |--------|-------|--------|
  | Reference resolution rate | **14/14 = 100%** | Every file:line citation points to a real line in `src/`. |
  | Snippet fidelity | **6/6 = 100%** | Every verbatim code block matches the source byte-for-byte. |
  | Claim support | **3/3 = 100%** | Each stated root cause is backed by at least one verified snippet and is reproducible. |
- **Pass/Fail rule:** PASS requires L3+. Result is L4 → **PASS**. The Bug Planner may proceed.

---

## 2. Verified Claims

### BUG-001 — `maxAmount` filter compares a string instead of a number
- **Primary ref `src/store.ts:30-36`** ✅ — snippet matches source exactly, including the
  `BUG-001` comment block, `const max = filters.maxAmount as unknown as number;`, and
  `result = result.filter((e) => e.amount <= max);`.
- **Offending statement `src/store.ts:34-35`** ✅ — line 34 is the no-op cast; line 35 is the
  comparison. Both resolve.
- **Support `src/types.ts:15-18`** ✅ — `ListFilters` with `maxAmount?: string;` matches exactly.
- **Support `src/app.ts:18-21`** ✅ — the `/expenses` handler destructures `maxAmount` as a
  `string` and forwards it unconverted to `listExpenses`. Matches exactly.
- **Root cause (cast is compile-time-only; no runtime conversion; `max` stays a string)** ✅ —
  fully supported by `src/store.ts:34-35`. Reproducible: a non-numeric `maxAmount` (e.g.
  `?maxAmount=abc`) coerces to `NaN`, making `e.amount <= NaN` always `false` and returning an
  empty set — a real, observable defect.

### BUG-002 — Unknown expense id returns 200 + empty body instead of 404
- **Primary ref `src/app.ts:33-38`** ✅ — snippet matches source exactly, including the `BUG-002`
  comment and the unconditional `res.json(expense);`.
- **Offending statement `src/app.ts:37`** ✅ — `res.json(expense);` with no `undefined` guard.
- **Support `src/store.ts:41-43`** ✅ — `getExpense` returns `Expense | undefined`; matches exactly.
- **Root cause (no guard for `undefined`; `res.json(undefined)` ⇒ 200 + empty body)** ✅ —
  supported by `src/app.ts:33-38` + `src/store.ts:41-43`. Reproducible with any unknown id.

### SEC-001 — Code injection via `eval()` in `/expenses/filter`
- **Snippet ref `src/app.ts:23-31`** ✅ — 9-line block matches source byte-for-byte, including the
  `SEC-001` comment block and `const result = listExpenses({}).filter((e) => eval(expr));`.
- **Handler / offending statement `src/app.ts:27-31`, eval at `src/app.ts:29`** ✅ — line 27 opens
  the `/expenses/filter` handler; line 28 reads `expr`; line 29 calls `eval(expr)`. All resolve.
- **Root cause (CWE-95: `eval` on attacker-controlled `expr`; `String(...)` adds no sanitization)**
  ✅ — supported by `src/app.ts:23-31`. Reproducible: `?expr=process.exit(1)` executes in-process.

---

## 3. Discrepancies Found

**None** that affect any measured metric. All file:line references resolve and all 6 verbatim
snippets match the source byte-for-byte.

**Minor non-blocking note (does not change the grade):** BUG-001's illustrative example
("`maxAmount=9` vs amount 100") is an imperfect demonstration. JavaScript's relational `<=`
applies `ToNumber` to a numeric string, so `100 <= "9"` correctly evaluates to `false`. The
research's own text acknowledges this. The bug is nonetheless **real and reproducible** — the cast
performs no runtime conversion (a genuine type-safety defect), and non-numeric input coerces to
`NaN`, returning an incorrect (empty) result set. The core root cause is accurate and snippet-backed;
only the chosen example understates the defect. This is an explanatory nuance, not a reference,
snippet, or support failure, so it is recorded as a note rather than a discrepancy.

---

## 4. Research Quality Assessment

**Chosen level: L4 — ✅ Verified.**

All three measured dimensions are perfect: reference resolution 100% (14/14), snippet fidelity 100%
(6/6, byte-exact including comment blocks and Unicode em-dashes), and claim support 100% (each of the
three root causes — the no-op cast in BUG-001, the missing `undefined` guard in BUG-002, and the
`eval()` injection in SEC-001 — is backed by a verified snippet and is independently reproducible).
Per the skill, the overall level is the lowest implied by the metrics; here every metric implies L4.
The only imperfection is BUG-001's understated reproduction example, which is an explanatory nuance
rather than a metric-affecting discrepancy and does not pull the grade below L4. Verdict: **PASS** —
the research is trustworthy and the Bug Planner may plan fixes directly from it.

---

## 5. References

Files inspected during verification (every line cited by the research was opened and confirmed):

- `src/store.ts` — lines 23-43 (`listExpenses` filter logic incl. 30-36/34-35; `getExpense` 41-43).
- `src/app.ts` — lines 18-38 (`/expenses` handler 18-21; `/expenses/filter` 23-31; `/expenses/:id`
  handler 33-38).
- `src/types.ts` — lines 1-18 (`ListFilters` 15-18).
- `context/bugs/001/research/codebase-research.md` — the research under verification.
