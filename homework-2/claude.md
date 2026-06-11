# homework-2: Intelligent Customer Support System

## Stack
Node.js · Express · TypeScript · SQLite (better-sqlite3) · Zod · Jest

## Key Files
- Requirements: TASKS.md
- Architecture, components, data flows: docs/ARCHITECTURE.md
- API contracts: docs/API_REFERENCE.md
- Test strategy: docs/TESTING_GUIDE.md (TBD)
- Tech decisions: docs/adr/ADR-001-technology-choices.md (TBD)

## Conventions
- Validation at controller boundary only via Zod
- Services never write raw SQL — repository layer only
- ClassificationService is pure — no DB access, no I/O
- app.ts exports Express app, server.ts calls listen()
- All datetimes UTC ISO-8601
- UUIDs generated server-side
- console.log for classification decision logging — no winston

## Commands
- Run: npx ts-node src/server.ts
- Test: npx jest --coverage
