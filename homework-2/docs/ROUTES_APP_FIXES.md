# Routes / App / Repository Fixes

> Applies to: `src/routes/tickets.routes.ts`, `src/app.ts`,
> `src/controllers/tickets.controller.ts`,
> `src/repositories/ticket.repository.ts`,
> `src/services/classification.service.ts`,
> `docs/ARCHITECTURE.md`, `docs/API_REFERENCE.md`
>
> After applying, run: `npx jest --coverage`

---

## Fix 1 (High) — Unsupported file type returns 415, not 500

### Problem
`fileFilter` in `src/routes/tickets.routes.ts:19` calls `cb(new Error(...))`.
A plain `Error` is not an `AppError`, so the global handler in `src/app.ts:26`
catches it as an unknown error and returns 500.
The API contract and TASKS.md require 415 for unsupported media types.

### Fix — `src/routes/tickets.routes.ts`

Import `UnsupportedMediaError` and use it in the `fileFilter` callback:

```typescript
import { UnsupportedMediaError } from '../utils/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/json',
      'text/xml',
      'application/xml',       // ← also add this (see Fix 5)
      'application/octet-stream',
    ];
    const filename = file.originalname.toLowerCase();
    const isValidMime = allowedMimes.includes(file.mimetype);
    const isValidExt =
      filename.endsWith('.csv') ||
      filename.endsWith('.json') ||
      filename.endsWith('.xml');

    if (isValidMime || isValidExt) {
      cb(null, true);
    } else {
      cb(new UnsupportedMediaError(file.mimetype));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});
```

`UnsupportedMediaError extends AppError`, so the global handler will now
serialize it as `{ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: '...' } }`
with status 415.

Also fix the test: `tests/test_ticket_api.test.ts` currently expects 500 for
an unsupported file type — change that assertion to expect 415.

---

## Fix 2 (High) — ValidationError.details missing from HTTP response

### Problem
`src/app.ts:21` serializes all `AppError` subclasses as `{ code, message }`.
`ValidationError` carries a `details` array that the API contract documents
as part of the 400 response body, but it is silently dropped.

### Fix — `src/app.ts`

Add `ValidationError` to the import and handle it before the generic `AppError`
branch:

```typescript
import { AppError, ValidationError } from './utils/errors';

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});
```

---

## Fix 3 (High) — Internal error message leaks through controller

### Problem
`handleValidationError()` in `src/controllers/tickets.controller.ts:144`
wraps any plain `Error` into `new AppError('INTERNAL_ERROR', error.message, 500)`.
Because the message is the raw `error.message`, internal details are returned
in the HTTP response — violating NFR-10.

### Fix — `src/controllers/tickets.controller.ts`

Replace the raw `error.message` with a generic string:

```typescript
// before
if (error instanceof Error) {
  return new AppError('INTERNAL_ERROR', error.message, 500);
}

// after
if (error instanceof Error) {
  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
}
```

---

## Fix 4 (Medium) — Nullable fields cannot be cleared via PATCH/PUT

### Problem
`UPDATE_TICKET` SQL uses `COALESCE(?, column)` for every field.
`COALESCE` treats `NULL` as "no value provided" and falls back to the current
DB value, so a client sending `{ "category": null }` to clear the category
silently leaves the old value unchanged.
`UpdateTicketSchema` explicitly allows `category: null` and `assigned_to: null`,
so this is a contract violation.

### Fix — `src/repositories/ticket.repository.ts`

Replace the static `UPDATE_TICKET` constant and the `update()` method with
dynamic SQL that only SETs the columns actually present in `data`.
A field absent from the patch is not included in the SQL → untouched.
A field present as `null` is written as `NULL` → clears the value.

Remove `UPDATE_TICKET` from the static constants block, then rewrite `update()`:

```typescript
update(id: string, data: InternalUpdatePatch): Ticket {
  const now = new Date().toISOString();

  // Only include columns that were explicitly provided in the patch.
  // Using 'key' in data instead of data.key !== undefined correctly handles
  // fields set to null (explicit clear) vs fields simply absent (no change).
  const setClauses: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  const add = (col: string, val: unknown) => {
    setClauses.unshift(`${col} = ?`);
    params.unshift(val);
  };

  if ('customer_id' in data)    add('customer_id',  data.customer_id    ?? null);
  if ('customer_email' in data) add('customer_email', data.customer_email ?? null);
  if ('customer_name' in data)  add('customer_name', data.customer_name  ?? null);
  if ('subject' in data)        add('subject',       data.subject        ?? null);
  if ('description' in data)    add('description',   data.description    ?? null);
  if ('category' in data)       add('category',      data.category       ?? null);
  if ('priority' in data)       add('priority',      data.priority       ?? null);
  if ('status' in data)         add('status',        data.status         ?? null);
  if ('resolved_at' in data)    add('resolved_at',   data.resolved_at    ?? null);
  if ('assigned_to' in data)    add('assigned_to',   data.assigned_to    ?? null);
  if ('tags' in data)           add('tags',          data.tags ? JSON.stringify(data.tags) : null);
  if ('metadata' in data)       add('metadata',      data.metadata ? JSON.stringify(data.metadata) : null);

  const sql = `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = ?`;
  params.push(id);

  this.db.prepare(sql).run(...params);

  const updated = this.findById(id);
  if (!updated) throw new Error(`Ticket ${id} not found after update`);
  return updated;
}
```

Also remove the `private static readonly UPDATE_TICKET` constant — it is no
longer used.

---

## Fix 5 (Medium) — `application/xml` missing from multer whitelist

### Problem
`src/routes/tickets.routes.ts:11` lists `['text/csv', 'application/json',
'text/xml', 'application/octet-stream']` but omits `application/xml`.
Clients sending `Content-Type: application/xml` have their file rejected
unless the filename ends in `.xml` — weaker than the documented contract.

### Fix

Already included in **Fix 1** above — add `'application/xml'` to `allowedMimes`.
No additional changes needed.

---

## Fix 6 (Medium) — `'bug'` missing from `technical_issue` keywords

### Problem
`src/services/classification.service.ts:18` lists the `technical_issue`
keywords but omits the plain word `'bug'`. TASKS.md states that
"technical_issue includes bugs" and `API_REFERENCE.md` lists `bug` as a
trigger for `technical_issue`. A ticket saying "I found a bug" will classify
as `other`.

### Fix — `src/services/classification.service.ts`

Add `'bug'` to the `technical_issue` keyword array:

```typescript
technical_issue: [
  'error',
  'crash',
  'exception',
  'not working',
  'broken',
  'fails',
  'failure',
  '500',
  'timeout',
  'bug',            // ← add
],
```

---

## Fix 7 (Medium) — Architecture doc contradicts ImportService implementation

### Problem
`docs/ARCHITECTURE.md` states ImportService "Never touches the database
directly", but `src/services/import.service.ts:3` imports `getDb()` and opens
the bulk-insert transaction directly. The checklist explicitly requires a
single SQLite transaction for performance (NFR-02), so the **code is correct**
and the **doc is wrong**.

### Fix — `docs/ARCHITECTURE.md`

Find the ImportService row in the component responsibility table (or equivalent
description) and update it to:

> `ImportService` — Parses CSV/JSON/XML buffers, validates records via
> `CreateTicketSchema`, delegates individual inserts to `TicketService.create()`.
> Wraps the entire import loop in a single SQLite transaction via `getDb()` for
> bulk-insert performance (NFR-02).

---

## Fix 8 (Low) — `classification_confidence` missing from API docs

### Problem
`docs/API_REFERENCE.md` Ticket response examples omit the
`classification_confidence` field even though it is returned by every
endpoint and persisted per FR-16.

### Fix — `docs/API_REFERENCE.md`

Add `classification_confidence` to every Ticket JSON example (use `null` for
unclassified tickets, a float like `0.75` for classified ones):

```json
{
  "id": "...",
  ...
  "classification_confidence": null
}
```

Also add a one-line field description in the Ticket model table:

| Field | Type | Description |
|-------|------|-------------|
| `classification_confidence` | `number \| null` | Confidence score (0–1) from the last auto-classify run; `null` if never classified |

---

## Summary of files touched

| File | Changes |
|------|---------|
| `src/routes/tickets.routes.ts` | `cb(new UnsupportedMediaError(...))`, add `application/xml` to whitelist |
| `src/app.ts` | Import `ValidationError`, emit `details` in 400 responses |
| `src/controllers/tickets.controller.ts` | Replace `error.message` with generic string |
| `src/repositories/ticket.repository.ts` | Dynamic SQL in `update()`, remove static `UPDATE_TICKET` |
| `src/services/classification.service.ts` | Add `'bug'` to `technical_issue` keywords |
| `docs/ARCHITECTURE.md` | Reconcile ImportService description with actual implementation |
| `docs/API_REFERENCE.md` | Add `classification_confidence` to Ticket model and response examples |
| `tests/test_ticket_api.test.ts` | Change unsupported-file-type assertion from 500 → 415 |
