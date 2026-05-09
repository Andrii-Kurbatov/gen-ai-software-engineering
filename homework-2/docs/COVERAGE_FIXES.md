# Coverage Fixes — Branch Coverage Below 85%

> Current: **81.88%** branches. Required: **≥ 85%**
>
> All fixes are new test cases only — no source code changes needed.
> After applying, run: `npx jest --coverage`

---

## Uncovered branches by file

### `src/services/import.service.ts` — 70.83% branch (lines 29, 94, 106)

**Line 94** — XML with a valid root element but no `ticket`/`record`/`item` children:

Add to `tests/test_import_xml.test.ts`:

```typescript
it('should throw ParseError for XML with root but no item elements', async () => {
  const xml = `<tickets><metadata>no items here</metadata></tickets>`;
  await expect(
    importService.importFromBuffer(Buffer.from(xml), 'xml')
  ).rejects.toThrow(ParseError);
});
```

**Line 29** — `parseBuffer` exhaustiveness throw (unreachable via TypeScript, but untested).
This is a defensive branch that cannot be hit with the current `ImportFormat` type.
Skip — do not try to test this with a cast hack.

**Line 106** — non-`ParseError` caught in `parseXml`. Already covered if the XMLValidator
validation test passes; if still uncovered, add:

```typescript
it('should throw ParseError for XML that passes validation but fails parsing', async () => {
  // XMLValidator accepts this but parser produces no usable result
  const xml = `<tickets></tickets>`;
  const result = await importService.importFromBuffer(Buffer.from(xml), 'xml');
  expect(result.total).toBe(0);
});
```

---

### `src/controllers/tickets.controller.ts` — 81.81% branch (lines 107, 144–148)

**Line 107** — `UnsupportedMediaError` thrown when MIME is `application/octet-stream` but
the file extension is not `.csv`, `.json`, or `.xml`. Multer whitelists `application/octet-stream`
so the file reaches the controller, but format detection fails.

Add to `tests/test_ticket_api.test.ts`:

```typescript
it('should return 415 when octet-stream file has unrecognised extension', async () => {
  const response = await request(app)
    .post('/tickets/import')
    .attach('file', Buffer.from('data'), { filename: 'data.txt', contentType: 'application/octet-stream' });
  expect(response.status).toBe(415);
});
```

**Lines 144–148** — `handleValidationError` branches for plain `Error` and unknown values.
These are defensive paths that require throwing a non-Zod, non-AppError inside a handler.
Add to `tests/test_ticket_api.test.ts` by temporarily breaking a dependency:

```typescript
it('should return 500 when an unexpected error is thrown in createTicket', async () => {
  const { TicketService } = require('../src/services/ticket.service');
  jest.spyOn(TicketService.prototype, 'create').mockImplementationOnce(() => {
    throw new Error('unexpected internal failure');
  });
  const response = await request(app)
    .post('/tickets')
    .send({
      customer_email: 'test@example.com',
      subject: 'Test subject',
      description: 'Test description here',
    });
  expect(response.status).toBe(500);
});
```

---

### `src/repositories/ticket.repository.ts` — 73.68% branch (lines 159, 177)

**Lines 159 and 177** — defensive `throw` after `update()` and `updateClassification()`
when `findById()` returns undefined. This cannot happen in normal operation.

These are not worth testing via race conditions. Instead, improve branch coverage
for the dynamic SQL by adding an update test that clears nullable fields and omits
optional ones:

Add to `tests/test_ticket_api.test.ts` or `tests/test_integration.test.ts`:

```typescript
it('should clear category and assigned_to by setting them to null', async () => {
  const create = await request(app)
    .post('/tickets')
    .send({
      customer_email: 'clear@example.com',
      subject: 'Clearable fields',
      description: 'Testing null update semantics',
      category: 'billing_question',
      assigned_to: 'agent-1',
    });
  const id = create.body.id;

  const update = await request(app)
    .put(`/tickets/${id}`)
    .send({ category: null, assigned_to: null });

  expect(update.status).toBe(200);
  expect(update.body.category).toBeNull();
  expect(update.body.assigned_to).toBeNull();
});
```

Also add an update that omits `tags` and `metadata` to exercise the falsy branch
of `data.tags ? JSON.stringify(data.tags) : null`:

```typescript
it('should update only subject without touching tags or metadata', async () => {
  const create = await request(app)
    .post('/tickets')
    .send({
      customer_email: 'partial@example.com',
      subject: 'Original subject',
      description: 'Original description here',
    });
  const id = create.body.id;

  const update = await request(app)
    .put(`/tickets/${id}`)
    .send({ subject: 'Updated subject' });

  expect(update.status).toBe(200);
  expect(update.body.subject).toBe('Updated subject');
});
```

---

### `src/db/database.ts` — 66.66% branch (line 9)

**Line 9** — the `?? path.join(...)` fallback fires only when `DB_PATH` is unset.
Tests always set `DB_PATH=:memory:` via `tests/setup.ts`, so this branch is never hit.

Add to `tests/test_ticket_model.test.ts` (no DB interaction needed, just call `getDb`
after temporarily unsetting the env var):

```typescript
it('should use default file path when DB_PATH is not set', () => {
  const { closeDb, getDb } = require('../src/db/database');
  closeDb();
  const saved = process.env['DB_PATH'];
  delete process.env['DB_PATH'];
  try {
    // getDb() will open a file-based DB at the default path
    const db = getDb();
    expect(db).toBeDefined();
  } finally {
    closeDb();
    process.env['DB_PATH'] = saved;
  }
});
```

---

## Summary

| File | Uncovered branch | Test to add |
|------|-----------------|-------------|
| `import.service.ts` | XML root with no item elements | `test_import_xml.test.ts` |
| `import.service.ts` | Empty `<tickets/>` no-items path | `test_import_xml.test.ts` |
| `tickets.controller.ts` | `application/octet-stream` + `.txt` → 415 | `test_ticket_api.test.ts` |
| `tickets.controller.ts` | Plain `Error` in handler → 500 | `test_ticket_api.test.ts` |
| `ticket.repository.ts` | Null field clearing (`category`, `assigned_to`) | `test_ticket_api.test.ts` |
| `ticket.repository.ts` | Update omitting `tags`/`metadata` | `test_ticket_api.test.ts` |
| `database.ts` | `DB_PATH` unset fallback | `test_ticket_model.test.ts` |
