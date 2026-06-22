# Security Report — Bug Fix 001 (Expense Tracker API)

**Scope:** Security review of the code modified for run 001, as listed under **Changed Files** in
`context/bugs/001/fix-summary.md` (`src/store.ts`, `src/app.ts`). Supporting files (`src/types.ts`,
`src/server.ts`, `package.json`) were read for context. **Report only — no source was modified.**

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 1 |
| LOW      | 1 |
| INFO     | 3 |

**Overall posture: GOOD.** The seeded critical vulnerability **SEC-001 (`eval()` code injection /
RCE, CWE-95) is fully resolved** in the changed code, and the three fixes introduced **no new
exposure**. No injection sinks (`eval`, `Function`, `child_process`, `exec`, dynamic `require`),
hardcoded secrets, or insecure secret comparisons exist anywhere in `src/`. The remaining findings
are **pre-existing input-validation hardening gaps** unrelated to the fix — none reach beyond the
in-memory data model and none are individually exploitable for code execution.

---

## Findings

### MEDIUM — Missing input validation on `POST /expenses`
- **file:line:** `src/app.ts:12-16`
- **Description:** The handler destructures `description`, `amount`, and `category` straight from
  `req.body` and passes them to `createExpense` with no validation. `amount` is never checked for
  type, sign, finiteness, or decimal precision; `description`/`category` are never type-checked or
  bounded. A request such as `{"amount":"abc"}` or `{"amount":-50}` is accepted verbatim. The
  unvalidated `amount` then flows into arithmetic in `getSummary` (`src/store.ts:47-49`), where a
  string produces concatenation/`NaN` totals, corrupting the `/summary` response. This is a
  data-integrity / robustness exposure rather than RCE, hence MEDIUM. **Pre-existing — not
  introduced by the BUG/SEC fixes** (the POST handler was not part of the diff), but it lives in a
  changed file and is in review scope.
- **Remediation:** Validate the body before persisting: require `amount` to be a finite positive
  number with ≤2 decimal places; require `description`/`category` to be non-empty strings within a
  sane length limit; reject anything else with `400` and a structured error
  (`{ "error": "Validation failed", "details": [...] }`). A small schema validator (e.g. `zod`) or
  explicit guards both work.

### LOW — Unvalidated `category` used as a dynamic object key in `getSummary`
- **file:line:** `src/store.ts:44-50`
- **Description:** `byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount` uses the
  user-controlled `category` string as an object property key. Supplying a special key such as
  `__proto__` or `constructor` makes the lookup/assignment interact with the prototype chain
  (`byCategory['__proto__']` is not `undefined`, so the `?? 0` fallback never fires and the `+`
  yields `NaN`). Classic prototype pollution is not achievable here because the assigned value is a
  primitive and there is no nested write, so impact is limited to summary-data corruption — hence
  LOW. Directly tied to the missing validation in the MEDIUM finding above.
- **Remediation:** Validate/whitelist `category` on input (see MEDIUM finding), and/or build the
  accumulator with `Object.create(null)` (a null-prototype map) or a `Map` so attacker-controlled
  keys cannot touch the prototype chain.

### INFO — `/expenses/filter` is now a functional duplicate of `/expenses`
- **file:line:** `src/app.ts:23-27`
- **Description:** After the SEC-001 fix, `/expenses/filter` reads the same `category`/`maxAmount`
  query params and calls the same `listExpenses(...)` as `GET /expenses` (`src/app.ts:18-21`). This
  is safe (no dynamic execution) — noted only as residual attack surface and dead-equivalent
  routing left behind by removing the `eval` path.
- **Remediation:** Optional. Remove the redundant route, or have it `301`/`302`-redirect to
  `/expenses`, to shrink the API surface and avoid divergent behavior over time.

### INFO — Dependency not exact-pinned (`express`)
- **file:line:** `package.json:15`
- **Description:** `express` is declared as `^4.19.2`, a caret range rather than an exact pin. A
  `package-lock.json` **is** committed, so installs are reproducible and transitive versions are
  locked, which mitigates most supply-chain drift. `4.19.2` is a safe floor (it includes the fix
  for the Express open-redirect CVE-2024-29041). No vulnerable or suspicious dependency was
  observed.
- **Remediation:** Run `npm audit` in CI to catch advisories on installed versions; optionally pin
  exact versions in `package.json` for stricter reproducibility. No immediate action required.

### INFO — XSS / CSRF surface
- **file:line:** `src/app.ts` (all handlers)
- **Description:** The service is a JSON API: every response uses `res.json(...)`
  (`Content-Type: application/json`, which escapes output), there is no HTML templating, no
  cookies/sessions/auth, and no state-changing `GET`. No reflected user input is rendered as
  markup. Reflected/stored XSS and CSRF are therefore not applicable in the current surface. Noted
  for completeness.
- **Remediation:** None required now. If a browser UI or auth/cookies are added later, introduce
  output encoding for any HTML context and CSRF protection (same-site cookies / token) for
  state-changing routes.

---

## Resolved Since Seeding

**SEC-001 — Code injection via `eval()` in `GET /expenses/filter` (CWE-95) — ✅ RESOLVED.**

- The vulnerable handler previously executed a user-supplied `expr` query parameter via
  `listExpenses({}).filter((e) => eval(expr))`, allowing arbitrary code execution
  (e.g. `?expr=process.exit(1)`).
- In the changed code (`src/app.ts:23-27`) the `eval()` call and the `expr` parameter are gone; the
  endpoint now performs structured, whitelisted filtering through `listExpenses({ category,
  maxAmount })` — exactly the same safe code path as `GET /expenses`.
- A repository-wide scan of `src/` confirms **no remaining** `eval(`, `new Function`,
  `child_process`, `exec(`, or dynamic `require()` sinks.
- **No new exposure** was introduced by this fix or by the accompanying BUG-001 (`parseFloat` +
  `isNaN` guard, `src/store.ts:30-35`) and BUG-002 (404 with a static error message,
  `src/app.ts:29-36`) changes — both add only safe, non-reflective logic.

---

## References — files reviewed

- `context/bugs/001/fix-summary.md` — change manifest
- `context/bugs/001/bug-context.md` — seeded-issue definitions (SEC-001)
- `src/app.ts` — **changed** (routes, request handling)
- `src/store.ts` — **changed** (filtering, summary aggregation)
- `src/types.ts` — context (data model)
- `src/server.ts` — context (bootstrap)
- `package.json` + `package-lock.json` — dependency review
