# Testing Guide

Comprehensive testing documentation for the Support Ticket System.

## Test Pyramid

```
          ┌─────────────────────┐
          │  Performance Tests  │  5 tests - Load & concurrency
          ├─────────────────────┤
          │  Integration Tests  │  5 tests - End-to-end workflows
          ├─────────────────────┤
          │   API Tests         │  11 tests - HTTP endpoints
          ├─────────────────────┤
          │   Service Tests     │  20 tests - Business logic
          │   (Import, Category)│
          ├─────────────────────┤
          │   Model Tests       │  9 tests - Schema validation
          └─────────────────────┘
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run with coverage report
```bash
npm run test:coverage
```

Output includes:
- Statements coverage: 96.61% ✓
- Branches coverage: 86.4% ✓ (requirement: ≥85%)
- Functions coverage: 96% ✓
- Lines coverage: 96.5% ✓

### Run specific test file
```bash
npm test -- test_ticket_api.test.ts
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run specific test by name
```bash
npm test -- -t "should POST /tickets with 201"
```

## Test Suites

### 1. Schema Validation Tests (`test_ticket_model.test.ts`)
**Tests**: 9 | **Purpose**: Validate Zod schemas at runtime

Tests CreateTicketSchema, UpdateTicketSchema, and TicketFiltersSchema:
- Valid minimal payloads pass validation
- Required fields enforced (email, subject, description)
- Email format validation
- String length constraints (subject 1-200, description 10-2000)
- Enum validation for priority, status, category
- Schema constraints (UpdateTicketSchema rejects empty/unknown fields)

**Data Files**: None - uses hardcoded test data

### 2. Categorization Tests (`test_categorization.test.ts`)
**Tests**: 15 | **Purpose**: Test keyword-based classification engine

Tests ClassificationService.classify():
- Category detection: account_access, technical_issue, billing_question, feature_request, bug_report, other
- Priority detection: urgent, high, low, medium
- Confidence scoring (matched keywords / total keywords)
- Tie-breaking logic (multiple categories with equal scores → 'other')
- Multiple keyword matching
- Edge cases (empty strings)

**Sample Input**:
- "Cannot login to my account" → category: account_access
- "Production database is down" → category: technical_issue, priority: urgent
- "Invoice payment issue" → category: billing_question

### 3. CSV Import Tests (`test_import_csv.test.ts`)
**Tests**: 7 | **Purpose**: Test CSV parsing and bulk import

Tests ImportService with CSV buffers:
- Valid CSV with multiple records imports correctly
- Invalid records are skipped, valid ones are inserted
- Malformed CSV (broken structure) throws ParseError
- Empty CSV returns zero counts
- Missing required fields recorded per row
- All-invalid CSV returns failed = total
- Extra fields in records are ignored

**Data Files**: 
- `tests/fixtures/sample_tickets.csv` - 50 valid tickets
- `tests/fixtures/invalid_tickets.csv` - Mixed valid/invalid rows
- `tests/fixtures/malformed.csv` - Structurally broken CSV

### 4. JSON Import Tests (`test_import_json.test.ts`)
**Tests**: 6 | **Purpose**: Test JSON parsing and bulk import

Tests ImportService with JSON buffers:
- Valid JSON array imports correctly
- Non-array JSON throws ParseError
- Malformed JSON (syntax errors) throws ParseError
- Mixed valid/invalid records handled per-record
- Empty array returns zero counts
- Invalid JSON format properly detected

**Data Files**:
- `tests/fixtures/sample_tickets.json` - 20 valid tickets
- `tests/fixtures/invalid_tickets.json` - Non-array with missing fields

### 5. XML Import Tests (`test_import_xml.test.ts`)
**Tests**: 7 | **Purpose**: Test XML parsing and bulk import

Tests ImportService with XML buffers:
- Valid XML with multiple tickets imports correctly
- Malformed XML (unclosed tags) throws ParseError
- Single-ticket XML (not array) imports correctly
- Mixed valid/invalid records handled per-record
- Unknown root elements throw ParseError
- XML with no ticket elements throws ParseError

**Data Files**:
- `tests/fixtures/sample_tickets.xml` - 30 valid tickets
- `tests/fixtures/malformed.xml` - Unclosed XML tags

### 6. API Endpoint Tests (`test_ticket_api.test.ts`)
**Tests**: 20 | **Purpose**: Test HTTP endpoints via Supertest

Tests all REST endpoints:
- **POST /tickets** - Create with valid/invalid data, auto-classification
- **GET /tickets** - List with filters (status, category, priority, assigned_to)
- **GET /tickets/:id** - Get existing/non-existent tickets
- **PUT /tickets/:id** - Update existing/non-existent tickets, empty body rejection
- **DELETE /tickets/:id** - Delete existing/non-existent tickets
- **POST /tickets/import** - File upload with format detection, unsupported types
- **POST /tickets/:id/auto-classify** - Classify existing/non-existent tickets

Error cases tested:
- Validation errors return 400
- Not found returns 404
- Unsupported format detection

### 7. Integration Tests (`test_integration.test.ts`)
**Tests**: 5 | **Purpose**: Test end-to-end workflows

Complete user journeys:
1. Full lifecycle: create → update to in_progress → resolve → verify resolved_at set
2. Bulk import CSV → auto-classify first imported ticket → verify category updated
3. GET with combined category + priority filters return correct subset
4. Import 20 tickets via JSON, verify successful count
5. Update ticket status to resolved sets resolved_at, to closed preserves resolved_at

Tests interdependencies between endpoints and database state.

### 8. Performance Tests (`test_performance.test.ts`)
**Tests**: 5 | **Purpose**: Test concurrent load handling

Load testing scenarios:
- 20 concurrent POST /tickets requests complete without error
- 20 concurrent GET /tickets requests all return 200
- Bulk import of 50-record CSV completes under 2000 ms
- 20 concurrent reads on same ticket id all return identical data
- 20 concurrent classification requests

Uses native fetch API for concurrent request generation.

## Sample Data Files

### Location: `tests/fixtures/`

| File | Records | Format | Status | Purpose |
|------|---------|--------|--------|---------|
| `sample_tickets.csv` | 50 | CSV | All valid | Large dataset for bulk testing |
| `sample_tickets.json` | 20 | JSON | All valid | JSON format testing |
| `sample_tickets.xml` | 30 | XML | All valid | XML format testing |
| `invalid_tickets.csv` | 8 | CSV | Mixed | Invalid email, missing fields |
| `invalid_tickets.json` | 4 | JSON | Mixed | Non-array root, missing fields |
| `malformed.csv` | - | CSV | Malformed | Unclosed quotes, bad structure |
| `malformed.xml` | - | XML | Malformed | Unclosed tags, bad structure |

## Manual Testing Checklist

### Pre-requisites
- Server running: `npm run dev`
- Postman or curl installed
- Sample fixture files available

### Tickets API

- [ ] **POST /tickets** 
  - [ ] Valid data creates ticket with 201
  - [ ] Missing email returns 400
  - [ ] Invalid email returns 400
  - [ ] auto_classify=true sets category/priority
  
- [ ] **GET /tickets**
  - [ ] Returns all tickets
  - [ ] Filters by status work
  - [ ] Filters by category work
  - [ ] Filters by priority work
  - [ ] Multiple filters work together
  
- [ ] **GET /tickets/:id**
  - [ ] Returns ticket for valid id
  - [ ] Returns 404 for invalid id
  
- [ ] **PUT /tickets/:id**
  - [ ] Updates single field
  - [ ] Updates multiple fields
  - [ ] Returns 404 for invalid id
  - [ ] Empty body returns 400
  - [ ] Status=resolved sets resolved_at
  
- [ ] **DELETE /tickets/:id**
  - [ ] Deletes existing ticket
  - [ ] Returns 404 for invalid id
  
### Import API

- [ ] **POST /tickets/import** (CSV)
  - [ ] Valid CSV imports all records
  - [ ] Invalid records show error details
  - [ ] Malformed CSV shows parse error
  
- [ ] **POST /tickets/import** (JSON)
  - [ ] Valid JSON array imports correctly
  - [ ] Non-array JSON shows parse error
  - [ ] Malformed JSON shows parse error
  
- [ ] **POST /tickets/import** (XML)
  - [ ] Valid XML imports correctly
  - [ ] Malformed XML shows parse error
  - [ ] Unknown root element shows error

### Classification API

- [ ] **POST /tickets/:id/auto-classify**
  - [ ] Returns category, priority, confidence
  - [ ] Returns 404 for invalid id
  - [ ] Keywords array populated

## Performance Benchmarks

### Endpoint Performance (p99 latency)

| Endpoint | Concurrent Users | Expected p99 | Actual |
|----------|------------------|--------------|--------|
| POST /tickets | 20 | < 100ms | - |
| GET /tickets | 20 | < 50ms | - |
| GET /tickets/:id | 20 | < 30ms | - |
| POST /tickets/import (50 records) | 1 | < 2000ms | - |
| POST /tickets/:id/auto-classify | 20 | < 100ms | - |

### Database Metrics

- Tickets table index on status: < 100ms for 1000 tickets
- Category index: < 50ms for filtering
- Priority index: < 50ms for filtering

## Test Coverage Details

### Current Coverage: 86.4% of Branches

High coverage areas:
- TicketService: 100%
- TicketSchema: 100%
- Routes: 100%
- ClassificationService: 100%

Areas with lower coverage (edge cases):
- ImportService: 70.83% (error paths in format detection)
- Database: 66.66% (DB instance creation branches)
- Controller: 81.81% (error handling edge cases)

## Continuous Integration

### CI Pipeline
```
1. Lint check (eslint)
2. Type check (tsc)
3. Unit tests (jest)
4. Coverage check (must exceed 85%)
5. Integration tests
6. Performance baseline
```

### Coverage Thresholds
- Statements: ≥ 85%
- Branches: ≥ 85% ✓ (currently 86.4%)
- Functions: ≥ 85%
- Lines: ≥ 85%

All thresholds currently met or exceeded.

## Debugging Tests

### Run single test with debugging
```bash
node --inspect-brk node_modules/.bin/jest --runInBand test_ticket_api.test.ts
```

Then open `chrome://inspect` in Chrome DevTools.

### View detailed test output
```bash
npm test -- --verbose
```

### Skip tests
```bash
test.skip('test name', () => {
  // this test is skipped
});
```

## Contributing Tests

When adding new functionality:
1. Write test first (TDD approach)
2. Implement feature to pass test
3. Verify coverage does not decrease
4. Add integration test if endpoint affected
5. Update this guide with new test location
