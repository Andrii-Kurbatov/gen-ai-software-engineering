# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a homework submission repository for the **GenAI and Agentic AI for Software Engineering** course. Each homework lives in its own directory (`homework-1/` through `homework-6/`) and is submitted as a pull request from a branch named `homework-X-submission` into `main` on the student's fork.

## Submission Workflow

Each homework follows this branch/PR pattern:
```bash
git checkout -b homework-X-submission
# implement the assignment
git push origin homework-X-submission
# then open a PR into main on the fork (NOT the upstream repo)
```

PRs must include: a detailed description, AI tools used, challenges encountered, and screenshots embedded or linked from `docs/screenshots/`. Bare or one-line PRs are rejected.

## Required Files per Homework

Every homework directory must contain:
- `README.md` — solution overview, features, architecture decisions, AI tools used
- `HOWTORUN.md` — step-by-step run instructions
- `docs/screenshots/` — AI interaction screenshots and running app screenshots
- `demo/run.sh` (or `run.bat`) — script to start the app
- `demo/sample-requests.http` or `demo/sample-requests.sh` — sample API calls

## Homework Assignments

| Dir | Assignment |
|-----|-----------|
| `homework-1/` | Banking Transactions REST API (in-memory storage, validation, filtering) |
| `homework-2/` | Enhanced app with tests |
| `homework-3/` | App built from specification |
| `homework-4/` | Multi-agent system |
| `homework-5/` | MCP server configuration |
| `homework-6/` | Capstone project |

## Homework 1 — Banking Transactions API

**Required endpoints:**
- `POST /transactions` — create transaction (returns 201)
- `GET /transactions` — list all, with optional filters `?accountId=`, `?type=`, `?from=`, `?to=`
- `GET /transactions/:id` — get by ID (404 if missing)
- `GET /accounts/:accountId/balance` — account balance

**Transaction model fields:** `id` (auto-generated), `fromAccount`, `toAccount`, `amount`, `currency` (ISO 4217), `type` (deposit|withdrawal|transfer), `timestamp` (ISO 8601), `status` (pending|completed|failed)

**Validation rules:**
- `amount`: positive number, max 2 decimal places
- `fromAccount`/`toAccount`: format `ACC-XXXXX` (alphanumeric X)
- `currency`: valid ISO 4217 codes only

**Error response shape:**
```json
{ "error": "Validation failed", "details": [{ "field": "amount", "message": "..." }] }
```

Technology choice is open — Node.js or Python are suggested defaults. Storage is in-memory (no database required).

## Grading Weights

Functionality 30% · AI Usage Documentation 25% · Code Quality 20% · Documentation 15% · Demo & Screenshots 10%
