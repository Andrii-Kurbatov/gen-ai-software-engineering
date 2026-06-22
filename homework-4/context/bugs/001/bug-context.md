# Bug Context — Run 001 (Expense Tracker API)

This file documents the issues **intentionally seeded** into `src/` for the 4-agent pipeline to
find and fix. It is the entry point for the Bug Researcher.

> The pipeline treats all three issues as one batch. The functional bugs are fixed by the Bug
> Fixer; the Security Verifier independently confirms `SEC-001` is resolved in the changed code.

---

## BUG-001 — `maxAmount` filter returns wrong results

- **File:** `src/store.ts` (the `maxAmount` branch of `listExpenses`)
- **Type:** Functional / type-coercion
- **Symptom:** `GET /expenses?maxAmount=9` does not correctly exclude expenses over 9. The query
  value arrives as a **string** and is compared against a numeric `amount` with `<=`, producing
  surprising JavaScript coercion results.
- **Expected:** Only expenses whose `amount` is `<= maxAmount` (numeric) are returned.
- **Fix direction:** Coerce `maxAmount` to a number before comparing.

## BUG-002 — Missing 404 for unknown expense id

- **File:** `src/app.ts` (the `GET /expenses/:id` handler)
- **Type:** Functional / error handling
- **Symptom:** Requesting a non-existent id responds **200** with an empty body instead of a
  **404** with an error shape.
- **Expected:** `404` and `{ "error": "Expense not found" }` (or similar) when the id is unknown.
- **Fix direction:** Return 404 when `getExpense` yields `undefined`.

## SEC-001 — Code injection via `eval()` in `/expenses/filter`  ⚠️ security

- **File:** `src/app.ts` (the `GET /expenses/filter` handler)
- **Type:** Security — CWE-95 Code Injection / Remote Code Execution
- **Symptom:** The handler evaluates a user-supplied `expr` query parameter with `eval()`. A
  request like `GET /expenses/filter?expr=process.exit(1)` executes arbitrary code in the server
  process.
- **Expected:** Filtering uses a safe, whitelisted field/operator parser (no dynamic code
  execution).
- **Fix direction:** Replace `eval` with a constrained parser (allowed fields: `amount`,
  `category`; allowed operators: `<`, `<=`, `>`, `>=`, `==`), or remove the endpoint.

---

## Run / Test commands

```bash
npm install
npm run dev     # start the API on :3000
npm test        # Jest
```
