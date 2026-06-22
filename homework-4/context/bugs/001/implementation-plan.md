# Implementation Plan — Bug Fix 001 (Expense Tracker API)

Verdict from verified research: ✅ **PASS** — all three issues are reproducible and
snippet-verified. Fixes below are surgical and self-contained.

---

## BUG-001 — `maxAmount` filter compares a string instead of a number

**Goal:** Convert the raw query-string value to a `number` at the point of use in `src/store.ts`
so the `<=` comparison is always numeric.

**Target:** `src/store.ts:30-36`

**Before:**
```ts
  if (filters.maxAmount !== undefined) {
    // BUG-001: `maxAmount` arrives from the query string as a string. Comparing
    // a number against a string here triggers surprising JS coercion, so the
    // `<=` filter returns incorrect results (e.g. maxAmount="9" vs amount 100).
    const max = filters.maxAmount as unknown as number;
    result = result.filter((e) => e.amount <= max);
  }
```

**After:**
```ts
  if (filters.maxAmount !== undefined) {
    const max = parseFloat(filters.maxAmount);
    if (!isNaN(max)) {
      result = result.filter((e) => e.amount <= max);
    }
  }
```

**Rationale:** `parseFloat` performs a real runtime string-to-number conversion; the existing
`as unknown as number` cast is compile-time-only and leaves `max` as a `string` at runtime.
The `isNaN` guard makes non-numeric inputs (e.g. `?maxAmount=abc`) return the unfiltered list
rather than an empty one, which is the least-surprising behaviour. No other callers of
`listExpenses` pass `maxAmount`, so the change is localised to this block.

**Test command:** `npm test`

---

## BUG-002 — Unknown expense id returns 200 + empty body instead of 404

**Goal:** Guard the `GET /expenses/:id` handler against an `undefined` result and return a
proper 404 with an error body.

**Target:** `src/app.ts:33-38`

**Before:**
```ts
  app.get('/expenses/:id', (req, res) => {
    const expense = getExpense(req.params.id);
    // BUG-002: when the id does not exist, the handler responds 200 with an
    // empty body instead of 404 + the documented error shape.
    res.json(expense);
  });
```

**After:**
```ts
  app.get('/expenses/:id', (req, res) => {
    const expense = getExpense(req.params.id);
    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    res.json(expense);
  });
```

**Rationale:** `getExpense` already returns `Expense | undefined` (`src/store.ts:41-43`).
Adding an explicit `!expense` guard before `res.json` prevents Express from serialising
`undefined` as an empty 200 body. The 404 error shape `{ error: string }` matches the
error pattern used elsewhere in the API. The `return` after the 404 response prevents
Express from attempting a second `res.json` call on the same response object.

**Test command:** `npm test`

---

## SEC-001 — Code injection via `eval()` in `GET /expenses/filter`

**Goal:** Remove the `eval()`-based filter endpoint and replace it with a safe
structured-query equivalent that accepts the same `category` and `maxAmount` parameters
as `GET /expenses`.

**Target:** `src/app.ts:23-31`

**Before:**
```ts
  // SEC-001: evaluates a user-supplied filter expression with `eval()`.
  // A request like `/expenses/filter?expr=process.exit(1)` executes arbitrary
  // code in the server process (CWE-95 — Code Injection / RCE).
  // NOTE: registered before `/expenses/:id` so "filter" is not treated as an id.
  app.get('/expenses/filter', (req, res) => {
    const expr = String(req.query.expr ?? 'true');
    const result = listExpenses({}).filter((e) => eval(expr));
    res.json(result);
  });
```

**After:**
```ts
  // NOTE: registered before `/expenses/:id` so "filter" is not treated as an id.
  app.get('/expenses/filter', (req, res) => {
    const { category, maxAmount } = req.query as { category?: string; maxAmount?: string };
    res.json(listExpenses({ category, maxAmount }));
  });
```

**Rationale:** `eval` on attacker-controlled input is CWE-95 (Arbitrary Code Execution);
`String(...)` provides no sanitisation. The replacement delegates to the already-correct
`listExpenses` function using the same structured filter path that `GET /expenses` uses,
preserving the route's intent (filter expenses) without any dynamic code evaluation.
The registration order comment is preserved because it is still relevant — the route must
stay before `/:id` so the literal path segment `"filter"` is not matched as an id.

**Test command:** `npm test`

---

## Order of Application

Apply the changes in this order (each is independent, but this order minimises diff noise):

1. **BUG-001** — `src/store.ts:30-36` (replace the cast block with `parseFloat` + `isNaN` guard)
2. **BUG-002** — `src/app.ts:33-38` (add `!expense` guard before `res.json`)
3. **SEC-001** — `src/app.ts:23-31` (replace `eval` block with structured-query delegation)

---

## Validation

Run after all three changes are applied:

```
npm test
```

All existing tests in `tests/health.test.ts` must continue to pass. If the test suite
contains tests for the three fixed behaviours they must also pass; if not, the fixer should
note which behaviours are untested but must **not** skip or modify failing tests to make
them green.
