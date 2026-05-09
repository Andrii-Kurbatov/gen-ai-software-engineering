# Support Ticket System

A Node.js/Express REST API for managing customer support tickets with automatic categorization and multi-format bulk import capabilities.

## Architecture

```
support-ticket-system
├── src/
│   ├── app.ts                 # Express app setup and middleware
│   ├── server.ts              # Server entry point
│   ├── controllers/           # HTTP request handlers
│   │   └── tickets.controller.ts
│   ├── services/              # Business logic layer
│   │   ├── ticket.service.ts
│   │   ├── classification.service.ts
│   │   └── import.service.ts
│   ├── repositories/          # Data access layer
│   │   └── ticket.repository.ts
│   ├── routes/                # Route definitions
│   │   └── tickets.routes.ts
│   ├── db/                    # Database setup and migrations
│   │   ├── database.ts
│   │   └── migrations.ts
│   ├── types/                 # TypeScript types and Zod schemas
│   │   └── ticket.types.ts
│   └── utils/                 # Utility functions and custom errors
│       └── errors.ts
├── tests/                     # Automated test suites
│   ├── test_ticket_model.test.ts
│   ├── test_categorization.test.ts
│   ├── test_import_csv.test.ts
│   ├── test_import_json.test.ts
│   ├── test_import_xml.test.ts
│   ├── test_ticket_api.test.ts
│   ├── test_integration.test.ts
│   ├── test_performance.test.ts
│   ├── setup.ts
│   └── fixtures/              # Sample data files
├── docs/                      # Documentation
│   ├── API_REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── TESTING_GUIDE.md
│   └── screenshots/
└── jest.config.ts             # Test configuration
```

## Features

- **CRUD Operations**: Create, read, update, and delete support tickets
- **Multi-Format Import**: Import tickets from CSV, JSON, or XML files
- **Automatic Categorization**: AI-powered ticket classification by category and priority using keyword matching
- **Filtering & Searching**: Query tickets by status, category, priority, and assignment
- **Error Handling**: Comprehensive error handling with meaningful error messages
- **Data Persistence**: SQLite database with migrations
- **Type Safety**: Full TypeScript support with Zod validation
- **Testing**: 86.4% test coverage with unit, integration, and performance tests

## Prerequisites

- Node.js 20+
- npm 10+
- SQLite (included with better-sqlite3)

## Installation

```bash
npm install
```

## Running the Application

**Development mode:**
```bash
npm run dev
```

**Production build and start:**
```bash
npm run build
npm start
```

The API will be available at `http://localhost:3000`.

## API Endpoints

### Tickets
- `POST /tickets` - Create a new ticket
- `GET /tickets` - List all tickets with optional filters
- `GET /tickets/:id` - Get a specific ticket
- `PUT /tickets/:id` - Update a ticket
- `DELETE /tickets/:id` - Delete a ticket
- `POST /tickets/import` - Bulk import tickets from file
- `POST /tickets/:id/auto-classify` - Auto-classify a ticket

See `docs/API_REFERENCE.md` for detailed documentation.

## Testing

**Run all tests:**
```bash
npm test
```

**Run tests with coverage:**
```bash
npm run test:coverage
```

**Run specific test suite:**
```bash
npm test -- test_ticket_api.test.ts
```

Current test coverage: **86.4%** of branches (requirement: ≥85%)

See `docs/TESTING_GUIDE.md` for detailed testing information and manual testing checklist.

## Project Structure

### Controllers (`src/controllers/`)
HTTP request handlers that validate input, call services, and send responses.

### Services (`src/services/`)
Business logic layer implementing core functionality:
- **TicketService**: CRUD operations and ticket management
- **ClassificationService**: Keyword-based automatic categorization
- **ImportService**: Multi-format file parsing and bulk import

### Repositories (`src/repositories/`)
Data access layer using prepared statements for SQL safety.

### Database (`src/db/`)
- Synchronous SQLite connection with transaction support
- Automatic schema migrations on startup
- In-memory SQLite for testing

## Key Technologies

- **Express.js**: Web framework
- **TypeScript**: Type safety
- **Zod**: Runtime schema validation
- **better-sqlite3**: Synchronous SQLite database
- **Jest**: Testing framework
- **Multer**: File upload handling
- **csv-parse**: CSV parsing
- **fast-xml-parser**: XML parsing

## Configuration

Environment variables:
- `DB_PATH`: Database file path (default: `tickets.db`)
- `PORT`: Server port (default: `3000`)

## Error Handling

The API returns structured error responses:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed"
  }
}
```

Common error codes:
- `NOT_FOUND`: Resource not found (404)
- `VALIDATION_ERROR`: Invalid request data (400)
- `PARSE_ERROR`: File parsing failed (400)
- `UNSUPPORTED_MEDIA_TYPE`: Unsupported file type (415)
- `INTERNAL_ERROR`: Server error (500)

## Development

To run in watch mode for active development:
```bash
npm run dev
```

The server will automatically restart when files change.

## License

University coursework - Gen AI Software Engineering
