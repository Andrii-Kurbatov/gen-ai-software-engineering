# Implementation Checklist

> For the implementing model. Read this fully before writing any code.

---

## Context

- Architecture: `docs/ARCHITECTURE.md`
- API contract: `docs/API_REFERENCE.md`
- All types/schemas: `src/types/ticket.types.ts`
- Error classes: `src/utils/errors.ts` — use these, do not create new ones
- DB singleton: `src/db/database.ts` — `getDb()` / `closeDb()`
- Migrations: `src/db/migrations.ts` — called automatically in `app.ts`
- Tests use in-memory SQLite — `tests/setup.ts` sets `DB_PATH=:memory:` before any imports

---

## Already Done — Do Not Re-implement

- [x] `package.json`, `tsconfig.json`, `jest.config.ts`
- [x] `src/app.ts` — Express app, global error handler, mounts `/tickets` router
- [x] `src/server.ts` — calls `app.listen()` only
- [x] `src/db/database.ts` — SQLite singleton
- [x] `src/db/migrations.ts` — `tickets` table + indexes
- [x] `src/utils/errors.ts` — `AppError`, `NotFoundError`, `ValidationError`, `ParseError`, `UnsupportedMediaError`
- [x] `src/types/ticket.types.ts` — all Zod schemas + inferred types + `InternalUpdatePatch`, `ImportFormat`, `RawRecord`
- [x] `src/repositories/ticket.repository.ts` — full implementation, `update()` accepts `InternalUpdatePatch`
- [x] `src/services/classification.service.ts` — keyword matching, tie-breaking, ordered priority, confidence formula
- [x] `src/services/ticket.service.ts` — CRUD + autoClassify, DI via constructor
- [x] `src/services/import.service.ts` — CSV/JSON/XML parsing, single-transaction bulk insert
- [x] `src/controllers/tickets.controller.ts` — all handlers, MIME normalization, async import handler
- [x] `src/routes/tickets.routes.ts` — all routes wired, multer middleware, `/import` before `/:id`
- [x] `tests/setup.ts` — sets `DB_PATH=:memory:`
- [x] `tests/fixtures/` — directory exists, sample files needed (see Step 7)

---

## Remaining Work

---

### Step 5.5 — Apply `docs/ROUTES_APP_FIXES.md` ⬅ NEXT

> A second Codex review found issues in routes, error handling, the repository,
> and classification. Apply all fixes in `docs/ROUTES_APP_FIXES.md` before
> running tests — several tests will fail or return wrong status codes until
> these are resolved.

Checklist:
- [ ] `src/routes/tickets.routes.ts` — `cb(new UnsupportedMediaError(...))`, add `application/xml`
- [ ] `src/app.ts` — emit `details` in ValidationError responses
- [ ] `src/controllers/tickets.controller.ts` — replace `error.message` with generic string
- [ ] `src/repositories/ticket.repository.ts` — dynamic SQL in `update()`, remove static `UPDATE_TICKET`
- [ ] `src/services/classification.service.ts` — add `'bug'` to `technical_issue` keywords
- [ ] `docs/ARCHITECTURE.md` — reconcile ImportService description
- [ ] `docs/API_REFERENCE.md` — add `classification_confidence` to Ticket model
- [ ] `tests/test_ticket_api.test.ts` — change unsupported-file-type assertion 500 → 415

---

### Step 6.5 — Verify Coverage ⬅ AFTER 5.5

Run the full test suite with coverage:

```bash
npx jest --coverage
```

Coverage must pass the thresholds configured in `jest.config.ts`:

| Metric | Threshold |
|--------|-----------|
| Statements | ≥ 85% |
| Branches | ≥ 85% |
| Functions | ≥ 85% |
| Lines | ≥ 85% |

**If coverage fails:**
- Check the HTML report in `coverage/index.html` to identify uncovered files/branches
- Add tests for uncovered paths before proceeding
- Common gaps: error branches in services (not-found throws), unsupported format in `ImportService`, empty filter combinations in repository

**When coverage passes:**
- Take a screenshot of the terminal output showing the coverage summary
- Save it as `docs/screenshots/test_coverage.png` (required deliverable)

---

## Already Done — Do Not Re-implement (continued)

- [x] `tests/test_ticket_model.test.ts`
- [x] `tests/test_categorization.test.ts`
- [x] `tests/test_import_csv.test.ts`
- [x] `tests/test_import_json.test.ts`
- [x] `tests/test_import_xml.test.ts`
- [x] `tests/test_ticket_api.test.ts`
- [x] `tests/test_integration.test.ts`
- [x] `tests/test_performance.test.ts`
- [x] `tests/fixtures/sample_tickets.csv`, `sample_tickets.json`, `sample_tickets.xml`
- [x] `tests/fixtures/invalid_tickets.csv`, `invalid_tickets.json`, `malformed.csv`, `malformed.xml`
- [x] `README.md`
- [x] `docs/TESTING_GUIDE.md`

---

## Constraints — Must Follow

1. **No `any` type** — `ticket.repository.ts` uses `any` in `rowToTicket`; avoid introducing new `any` usages
2. **Zod validation only in controllers** — services receive already-validated DTOs
3. **Services never import `getDb()` directly** — only `TicketRepository` touches the DB
4. **`ImportService` wraps all inserts in a single DB transaction**
5. **`/import` route declared before `/:id`** in the router
6. **Test files call `closeDb()` in `afterAll`** to reset the singleton between files
7. **All errors propagate via `next(err)`** in controllers — never swallow with `console.error` + res.json in handlers
