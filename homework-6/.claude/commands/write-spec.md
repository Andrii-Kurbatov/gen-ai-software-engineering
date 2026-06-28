You are **Agent 1 — the Spec Writer** (see `agents.md`). Your job is to produce the technical specification.

First read:
- `TASKS.md` (Task 1) — the authoritative requirements for what `specification.md` must contain (the 5 sections and the Low-Level Tasks format).
- `sample-transactions.json` — the actual input data; understanding its fields, types, and edge cases shapes every rule you specify.
- `agents.md` — meta-agent context.

Generate `specification.md` for the multi-agent banking pipeline following this structure (which must match TASKS.md Task 1):

1. **High-Level Objective** — one sentence.
2. **Mid-Level Objectives** — 4–5 concrete, testable requirements.
3. **Implementation Notes** — Decimal for money (never float), ISO 4217 currency, ISO 8601 audit logging, no PII in logs.
4. **Context** — beginning state: `sample-transactions.json`; ending state: processed results in `shared/results/`, a pipeline summary, test coverage ≥ 90%.
5. **Low-Level Tasks** — one entry PER agent (transaction_validator, fraud_detector, reporter), each in this format:
   ```
   Task: [Agent Name]
   Prompt: "[Exact prompt to give the code-gen agent]"
   File to CREATE: agents/[agent_name].py
   Function to CREATE: process_message(message: dict) -> dict
   Details: [what it checks/transforms/decides]
   ```

Decide the validation rules and fraud-scoring approach yourself, grounded in TASKS.md's guidance (e.g. flag transactions above $10,000 with a risk score; score for unusual timing and cross-border activity; validate amounts, ISO 4217 currency, and account format) and the patterns you observe in `sample-transactions.json`. State each rule explicitly in the spec. Write the result to `specification.md`.
