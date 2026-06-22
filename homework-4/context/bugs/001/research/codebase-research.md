# Codebase Research — Run 001 (Expense Tracker API)

Stage: **Bug Researcher** (find & document only — no fixes).
Source reviewed: `src/store.ts`, `src/app.ts`, `src/server.ts`, `src/types.ts`.

All snippets below are copied **verbatim** from the source so the Research Verifier can
byte-match them. Line numbers reflect the files as read.

---

## BUG-001 — `maxAmount` filter returns wrong results

- **ID:** `BUG-001`
- **Type:** Functional / type-coercion
- **File:line:** `src/store.ts:30-36` (offending statement at `src/store.ts:34-35`)

**Verbatim source snippet** (`src/store.ts:30-36`):

```ts
  if (filters.maxAmount !== undefined) {
    // BUG-001: `maxAmount` arrives from the query string as a string. Comparing
    // a number against a string here triggers surprising JS coercion, so the
    // `<=` filter returns incorrect results (e.g. maxAmount="9" vs amount 100).
    const max = filters.maxAmount as unknown as number;
    result = result.filter((e) => e.amount <= max);
  }
```

Supporting context — `maxAmount` is typed as a `string` and flows in unconverted:

- `src/types.ts:15-18`
  ```ts
  export type ListFilters = {
    category?: string;
    maxAmount?: string;
  };
  ```
- `src/app.ts:18-21`
  ```ts
  app.get('/expenses', (req, res) => {
    const { category, maxAmount } = req.query as { category?: string; maxAmount?: string };
    res.json(listExpenses({ category, maxAmount }));
  });
  ```

**Observed behavior:** `GET /expenses?maxAmount=9` does not correctly exclude expenses whose
`amount` exceeds 9. The query value arrives as the **string** `"9"`, and `e.amount <= max`
compares a `number` against a `string`. JS coerces the string to a number for relational `<=`,
but the comparison is lexical/coercion-fragile in surprising cases (e.g. `100 <= "9"` is `false`,
yet `9 <= "10"`-style cross-type comparisons and edge inputs produce inconsistent results), so the
filter returns the wrong set of expenses.

**Expected behavior:** Only expenses whose numeric `amount` is `<= maxAmount` (compared
numerically) are returned.

**Root cause:** The cast `filters.maxAmount as unknown as number` (`src/store.ts:34`) is a
**compile-time-only** assertion — it tells TypeScript to treat the value as a `number` but performs
**no runtime conversion**. At runtime `max` is still the original string from the query string, so
`e.amount <= max` (`src/store.ts:35`) performs a number-vs-string comparison instead of a numeric
one. Coercing `maxAmount` to a real number (e.g. `Number(filters.maxAmount)` / `parseFloat`) before
the comparison is required.

---

## BUG-002 — Missing 404 for unknown expense id

- **ID:** `BUG-002`
- **Type:** Functional / error handling
- **File:line:** `src/app.ts:33-38` (offending statement at `src/app.ts:37`)

**Verbatim source snippet** (`src/app.ts:33-38`):

```ts
  app.get('/expenses/:id', (req, res) => {
    const expense = getExpense(req.params.id);
    // BUG-002: when the id does not exist, the handler responds 200 with an
    // empty body instead of 404 + the documented error shape.
    res.json(expense);
  });
```

Supporting context — `getExpense` returns `undefined` for an unknown id:

- `src/store.ts:41-43`
  ```ts
  export function getExpense(id: string): Expense | undefined {
    return expenses.find((e) => e.id === id);
  }
  ```

**Observed behavior:** Requesting a non-existent id (e.g. `GET /expenses/does-not-exist`) responds
with HTTP **200** and an effectively empty body. `getExpense` returns `undefined`, and
`res.json(undefined)` serializes with a `200` status.

**Expected behavior:** Respond with HTTP **404** and an error shape such as
`{ "error": "Expense not found" }` when the id is unknown.

**Root cause:** The handler (`src/app.ts:37`) unconditionally calls `res.json(expense)` without
checking whether `expense` is `undefined`. There is no guard that returns `404` when
`getExpense(req.params.id)` yields `undefined` (`src/store.ts:42`). A check is needed before the
`res.json` call to branch to a `404` + error body.

---

## SEC-001 — Code injection via `eval()` in `/expenses/filter` ⚠️ security

- **ID:** `SEC-001`
- **Type:** Security — CWE-95 Code Injection / Remote Code Execution
- **File:line:** `src/app.ts:27-31` (offending statement at `src/app.ts:29`)

**Verbatim source snippet** (`src/app.ts:23-31`):

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

**Observed behavior:** The handler reads the user-supplied `expr` query parameter
(`src/app.ts:28`) and passes it directly to `eval()` inside the array `.filter` callback
(`src/app.ts:29`). The expression is executed as live JavaScript in the server process with full
access to the runtime scope (e.g. `process`, `require`). A request like
`GET /expenses/filter?expr=process.exit(1)` terminates the server; more dangerous payloads can read
the filesystem, exfiltrate data, or achieve full remote code execution.

**Expected behavior:** Filtering uses a safe, whitelisted field/operator parser with **no dynamic
code execution** — allowed fields `amount`, `category`; allowed operators `<`, `<=`, `>`, `>=`,
`==` — or the endpoint is removed.

**Root cause:** Use of `eval(expr)` on attacker-controlled input (`src/app.ts:29`) interprets the
raw query string as code (CWE-95). The `String(...)` wrapper at `src/app.ts:28` only stringifies the
input; it provides no sanitization or sandboxing. The fix must replace `eval` with a constrained
parser that whitelists fields/operators (or drop the endpoint entirely).

---

## Summary

| ID | File:line | Issue | Fix direction |
|----|-----------|-------|---------------|
| BUG-001 | `src/store.ts:34-35` | Compile-time-only cast leaves `maxAmount` a string; `<=` compares number vs string | Coerce `maxAmount` to a number (`Number`/`parseFloat`) before comparing |
| BUG-002 | `src/app.ts:37` | Unknown id returns 200 + empty body (`res.json(undefined)`) | Return `404` + `{ "error": "Expense not found" }` when `getExpense` is `undefined` |
| SEC-001 | `src/app.ts:29` | `eval(expr)` on user input → CWE-95 RCE | Replace with whitelisted field/operator parser, or remove the endpoint |
