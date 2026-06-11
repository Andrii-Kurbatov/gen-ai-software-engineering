# ADR-001: Technology Stack Selection

**Date:** 2026-05-04
**Status:** Accepted

---

## Context

Building a customer support ticket management REST API in Node.js/Express with multi-format import, auto-classification, and a comprehensive test suite (>85% coverage).

---

## Decisions

### Language: TypeScript over plain JavaScript

| Option | Pros | Cons |
|--------|------|------|
| **TypeScript** ✅ | Compile-time safety, enums, interfaces, inferred types from Zod schemas | Extra build config (~10 min setup) |
| JavaScript | Zero config | No type safety, runtime errors where compiler errors are expected |

**Reason:** The ticket model has many enums, nullable fields, and strict validation rules. TypeScript catches shape mismatches at compile time. Developer background is Salesforce Apex (statically typed), so TypeScript aligns with existing mental model.

---

### Schema Validation: Zod over Joi

| Option | Pros | Cons |
|--------|------|------|
| **Zod** ✅ | TypeScript-first, infers TS types from schema — no duplication | Newer, smaller ecosystem |
| Joi | Battle-tested, large ecosystem | Predates TypeScript, weak type inference, requires separate type definitions |

**Reason:** With TypeScript, Zod eliminates duplication — one schema serves as both runtime validator and compile-time type via `z.infer<typeof Schema>`. Joi would require maintaining a separate `interface` alongside the validator.

---

### CSV Parsing: csv-parse over papaparse

| Option | Pros | Cons |
|--------|------|------|
| **csv-parse** ✅ | Server-side focused, handles edge cases (quoted fields, escaped commas), well-maintained | Slightly more verbose API |
| papaparse | Very simple API | Originally browser-focused, less common server-side |

**Reason:** `csv-parse` is the standard for server-side Node.js CSV handling.

---

### XML Parsing: fast-xml-parser over xml2js

| Option | Pros | Cons |
|--------|------|------|
| **fast-xml-parser** ✅ | Clean JS object output, fast, no dependencies | Smaller community |
| xml2js | Popular, large community | Produces awkward nested output requiring cleanup |

**Reason:** `fast-xml-parser` output maps more directly to the ticket model without post-processing.

---

### JSON Parsing: Native JSON.parse

**Reason:** Built-in to Node.js. No library needed.

---

### File Upload Middleware: multer (no alternatives considered)

`multer` with `memoryStorage()` is the standard Express middleware for `multipart/form-data`. Files are kept in memory as buffers and parsed immediately — no temp files written to disk.

---

### Database: SQLite (better-sqlite3) over LowDB / in-memory / MongoDB

| Option | Pros | Cons |
|--------|------|------|
| **SQLite (better-sqlite3)** ✅ | No server, file-based, synchronous API, handles concurrent writes | Binary `.db` file (less human-readable) |
| LowDB | Extremely simple, human-readable JSON file | Reads/writes entire file per operation, unsafe under concurrent writes |
| Plain JS Map/array | Zero setup | Lost on restart, no concurrency safety |
| MongoDB | Native JSON documents, flexible schema | Requires running server, extra setup |

**Reason:** Task 5 requires 20+ simultaneous concurrent requests. LowDB is not safe for concurrent writes and would corrupt data under load. SQLite handles concurrency correctly with zero server setup. `better-sqlite3` uses a synchronous API which is simpler to reason about.

---

### Logging: console over winston

| Option | Pros | Cons |
|--------|------|------|
| **console.log/debug** ✅ | Zero dependencies, built-in, sufficient for homework scale | No log levels, no structured JSON output |
| winston | Structured JSON logs, log levels, transports | Extra dependency, configuration overhead |

**Reason:** The only logging requirement is recording classification decisions. `console.debug` covers that with no additional setup or dependencies.

---

### Testing: Jest + Supertest + autocannon

| Concern | Choice | Alternatives considered |
|---------|--------|------------------------|
| Test runner + coverage | **Jest** | Mocha+Chai (more setup, separate coverage tool needed) |
| HTTP assertions | **Supertest** | Axios in tests (requires real server running) |
| Performance / load testing | **autocannon** | k6 (more powerful but separate install and scripting language) |

**Reason:** Jest covers test running, assertions, mocking, and coverage in one package. Supertest tests Express routes without starting a real HTTP server. autocannon can be called programmatically from within Jest test files for Task 5 concurrency tests.

---

## Final Stack

```
Runtime:     Node.js
Framework:   Express
Language:    TypeScript
Validation:  Zod
Database:    SQLite (better-sqlite3)
CSV:         csv-parse
XML:         fast-xml-parser
Uploads:     multer
Testing:     Jest + Supertest + autocannon
```
