# API Reference: Intelligent Customer Support System

**Base URL:** `http://localhost:3000`
**Content-Type:** `application/json` (except `/import` which uses `multipart/form-data`)

---

## Table of Contents

1. [Data Models](#data-models)
2. [Error Format](#error-format)
3. [Endpoints](#endpoints)
   - [POST /tickets](#post-tickets)
   - [GET /tickets](#get-tickets)
   - [GET /tickets/:id](#get-ticketsid)
   - [PUT /tickets/:id](#put-ticketsid)
   - [DELETE /tickets/:id](#delete-ticketsid)
   - [POST /tickets/import](#post-ticketsimport)
   - [POST /tickets/:id/auto-classify](#post-ticketsidauto-classify)

---

## Data Models

### Ticket

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "CUST-001",
  "customer_email": "jane@example.com",
  "customer_name": "Jane Smith",
  "subject": "Cannot log into my account",
  "description": "I've been unable to log in since yesterday. Getting error code 403.",
  "category": "account_access",
  "priority": "high",
  "status": "new",
  "created_at": "2026-05-04T10:00:00.000Z",
  "updated_at": "2026-05-04T10:00:00.000Z",
  "resolved_at": null,
  "assigned_to": null,
  "tags": ["login", "access"],
  "metadata": {
    "source": "web_form",
    "browser": "Chrome 124",
    "device_type": "desktop"
  },
  "classification_confidence": 0.87
}
```

#### Field Reference

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID string | Auto-generated | Read-only |
| `customer_id` | string | No | — |
| `customer_email` | string | **Yes** | Valid email format |
| `customer_name` | string | No | — |
| `subject` | string | **Yes** | 1–200 characters |
| `description` | string | **Yes** | 10–2000 characters |
| `category` | enum | No | `account_access` · `technical_issue` · `billing_question` · `feature_request` · `bug_report` · `other` |
| `priority` | enum | No | `urgent` · `high` · `medium` · `low` · Default: `medium` |
| `status` | enum | No | `new` · `in_progress` · `waiting_customer` · `resolved` · `closed` · Default: `new` |
| `created_at` | ISO 8601 datetime | Auto-generated | Read-only |
| `updated_at` | ISO 8601 datetime | Auto-generated | Read-only |
| `resolved_at` | ISO 8601 datetime \| null | No | Set automatically when status → `resolved` |
| `assigned_to` | string \| null | No | — |
| `tags` | string[] | No | Default: `[]` |
| `metadata.source` | enum | No | `web_form` · `email` · `api` · `chat` · `phone` |
| `metadata.browser` | string | No | — |
| `metadata.device_type` | enum | No | `desktop` · `mobile` · `tablet` |
| `classification_confidence` | number \| null | No | Confidence score (0–1) from the last auto-classify run; `null` if never classified |

---

### ClassificationResult

```json
{
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "account_access",
  "priority": "urgent",
  "confidence": 0.87,
  "reasoning": "Subject and description contain high-priority access keywords",
  "keywords": ["can't access", "login", "403"]
}
```

---

### ImportResult

```json
{
  "total": 50,
  "successful": 47,
  "failed": 3,
  "errors": [
    {
      "row": 12,
      "record": { "customer_email": "not-an-email" },
      "errors": ["customer_email: Invalid email"]
    }
  ]
}
```

---

## Error Format

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "customer_email",
        "message": "Invalid email"
      }
    ]
  }
}
```

### HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| `200` | OK | Successful GET, PUT, auto-classify |
| `201` | Created | Ticket created |
| `400` | Bad Request | Validation failure, malformed file |
| `404` | Not Found | Ticket ID does not exist |
| `409` | Conflict | Duplicate ticket ID (import) |
| `415` | Unsupported Media Type | Unknown file format on import |
| `500` | Internal Server Error | Unhandled exception |

---

## Endpoints

---

### POST /tickets

Create a single support ticket.

**Request Body**

```json
{
  "customer_id": "CUST-001",
  "customer_email": "jane@example.com",
  "customer_name": "Jane Smith",
  "subject": "Cannot log into my account",
  "description": "I've been unable to log in since yesterday. Getting error code 403.",
  "category": "account_access",
  "priority": "high",
  "tags": ["login"],
  "metadata": {
    "source": "web_form",
    "browser": "Chrome 124",
    "device_type": "desktop"
  }
}
```

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `auto_classify` | boolean | `false` | Run auto-classification on creation |

**Response — 201 Created**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "CUST-001",
  "customer_email": "jane@example.com",
  "customer_name": "Jane Smith",
  "subject": "Cannot log into my account",
  "description": "I've been unable to log in since yesterday. Getting error code 403.",
  "category": "account_access",
  "priority": "high",
  "status": "new",
  "created_at": "2026-05-04T10:00:00.000Z",
  "updated_at": "2026-05-04T10:00:00.000Z",
  "resolved_at": null,
  "assigned_to": null,
  "tags": ["login"],
  "metadata": {
    "source": "web_form",
    "browser": "Chrome 124",
    "device_type": "desktop"
  }
}
```

**cURL**

```bash
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "jane@example.com",
    "subject": "Cannot log into my account",
    "description": "I have been unable to log in since yesterday. Getting error code 403."
  }'
```

With auto-classify:

```bash
curl -X POST "http://localhost:3000/tickets?auto_classify=true" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "jane@example.com",
    "subject": "Cannot log into my account",
    "description": "I have been unable to log in since yesterday. Getting error code 403."
  }'
```

---

### GET /tickets

List all tickets with optional filtering.

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum | Filter by status |
| `category` | enum | Filter by category |
| `priority` | enum | Filter by priority |
| `assigned_to` | string | Filter by assignee |

**Response — 200 OK**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_email": "jane@example.com",
    "subject": "Cannot log into my account",
    "category": "account_access",
    "priority": "high",
    "status": "new",
    "created_at": "2026-05-04T10:00:00.000Z",
    "updated_at": "2026-05-04T10:00:00.000Z"
  }
]
```

**cURL**

```bash
# All tickets
curl http://localhost:3000/tickets

# Filter by priority and status
curl "http://localhost:3000/tickets?priority=urgent&status=new"

# Filter by category
curl "http://localhost:3000/tickets?category=billing_question"
```

---

### GET /tickets/:id

Retrieve a single ticket by ID.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Ticket identifier |

**Response — 200 OK**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "CUST-001",
  "customer_email": "jane@example.com",
  "customer_name": "Jane Smith",
  "subject": "Cannot log into my account",
  "description": "I've been unable to log in since yesterday. Getting error code 403.",
  "category": "account_access",
  "priority": "high",
  "status": "new",
  "created_at": "2026-05-04T10:00:00.000Z",
  "updated_at": "2026-05-04T10:00:00.000Z",
  "resolved_at": null,
  "assigned_to": null,
  "tags": ["login"],
  "metadata": {
    "source": "web_form",
    "browser": "Chrome 124",
    "device_type": "desktop"
  }
}
```

**Response — 404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ticket 550e8400-e29b-41d4-a716-446655440000 not found"
  }
}
```

**cURL**

```bash
curl http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000
```

---

### PUT /tickets/:id

Update a ticket. Only provided fields are changed (`id`, `created_at` are immutable).

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Ticket identifier |

**Request Body** (all fields optional)

```json
{
  "status": "in_progress",
  "assigned_to": "agent@support.com",
  "priority": "urgent"
}
```

**Response — 200 OK**

Returns the full updated ticket object.

**cURL**

```bash
curl -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "assigned_to": "agent@support.com"}'
```

Resolve a ticket:

```bash
curl -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}'
```

---

### DELETE /tickets/:id

Delete a ticket permanently.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Ticket identifier |

**Response — 204 No Content**

Empty body.

**Response — 404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ticket 550e8400-e29b-41d4-a716-446655440000 not found"
  }
}
```

**cURL**

```bash
curl -X DELETE http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000
```

---

### POST /tickets/import

Bulk import tickets from a CSV, JSON, or XML file.

**Request**

`Content-Type: multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | `.csv`, `.json`, or `.xml` file — max 10 MB |

**File Format Examples**

**CSV** — first row is header, columns match ticket field names:

```csv
customer_email,customer_name,subject,description,category,priority,status
jane@example.com,Jane Smith,Cannot login,I cannot login since yesterday,account_access,high,new
bob@example.com,Bob Jones,Invoice wrong,My invoice shows wrong amount,billing_question,medium,new
```

**JSON** — array of ticket objects:

```json
[
  {
    "customer_email": "jane@example.com",
    "customer_name": "Jane Smith",
    "subject": "Cannot login",
    "description": "I cannot login since yesterday",
    "category": "account_access",
    "priority": "high"
  }
]
```

**XML**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_email>jane@example.com</customer_email>
    <customer_name>Jane Smith</customer_name>
    <subject>Cannot login</subject>
    <description>I cannot login since yesterday</description>
    <category>account_access</category>
    <priority>high</priority>
  </ticket>
</tickets>
```

**Response — 200 OK**

```json
{
  "total": 50,
  "successful": 47,
  "failed": 3,
  "errors": [
    {
      "row": 12,
      "record": { "customer_email": "not-an-email", "subject": "Test" },
      "errors": ["customer_email: Invalid email"]
    },
    {
      "row": 23,
      "record": { "customer_email": "valid@email.com", "subject": "X" },
      "errors": ["subject: String must contain at least 1 character", "description: Required"]
    },
    {
      "row": 38,
      "record": { "priority": "CRITICAL" },
      "errors": ["priority: Invalid enum value"]
    }
  ]
}
```

**Response — 400 Bad Request** (malformed file)

```json
{
  "error": {
    "code": "PARSE_ERROR",
    "message": "Failed to parse CSV: unexpected token at line 5"
  }
}
```

**cURL**

```bash
# CSV import
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@sample_tickets.csv"

# JSON import
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@sample_tickets.json"

# XML import
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@sample_tickets.xml"
```

---

### POST /tickets/:id/auto-classify

Run automatic classification on an existing ticket. Updates the ticket's `category` and `priority` fields and persists the result.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Ticket identifier |

**Response — 200 OK**

```json
{
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "account_access",
  "priority": "urgent",
  "confidence": 0.87,
  "reasoning": "Subject contains 'can't access' (urgent priority keyword). Description mentions 'login' and '403' (account_access category keywords).",
  "keywords": ["can't access", "login", "403"]
}
```

**Response — 404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ticket 550e8400-e29b-41d4-a716-446655440000 not found"
  }
}
```

**Classification Rules**

| Priority | Keywords |
|----------|---------|
| `urgent` | `can't access`, `critical`, `production down`, `security` |
| `high` | `important`, `blocking`, `asap` |
| `low` | `minor`, `cosmetic`, `suggestion` |
| `medium` | *(default — no keyword match)* |

| Category | Keywords |
|----------|---------|
| `account_access` | `login`, `password`, `2fa`, `access`, `sign in`, `locked out` |
| `technical_issue` | `error`, `bug`, `crash`, `not working`, `broken`, `exception` |
| `billing_question` | `invoice`, `payment`, `charge`, `refund`, `billing`, `subscription` |
| `feature_request` | `feature`, `enhancement`, `would be nice`, `suggest`, `improve` |
| `bug_report` | `reproduce`, `steps to reproduce`, `expected behavior`, `actual behavior` |
| `other` | *(default — no keyword match)* |

**cURL**

```bash
curl -X POST http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000/auto-classify
```
