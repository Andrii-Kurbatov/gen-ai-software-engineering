# specification.md — AI-Powered Multi-Agent Banking Pipeline

---

## 1. High-Level Objective

Process raw banking transactions from `sample-transactions.json` through a three-stage pipeline (validation → fraud detection → reporting) and write structured JSON results plus a summary report to `shared/results/`.

---

## 2. Mid-Level Objectives

1. **Validation gate**: every transaction is checked for required fields, positive amount with at most 2 decimal places, valid ISO 4217 currency code, and `ACC-XXXXX` account format; invalid transactions are rejected with a `reason` field and never reach the fraud detector.
2. **Fraud scoring**: each valid transaction receives a numeric risk score (0–100) and a risk level (`LOW`, `MEDIUM`, `HIGH`) based on amount thresholds, time-of-day anomalies, cross-border activity, and structuring patterns; transactions scoring ≥ 70 are flagged for manual review.
3. **Structured results**: every transaction — valid or rejected — lands in `shared/results/` as an individual JSON file containing the full message envelope plus the agent's verdict.
4. **Pipeline summary**: the reporter writes `shared/results/pipeline_summary.json` with total count, valid/rejected counts, risk-level distribution, and flagged transaction IDs.
5. **Audit trail**: every agent logs each decision to stdout and to `shared/results/pipeline.log` using ISO 8601 timestamps, agent name, `transaction_id` (masked source/destination accounts), and outcome — no plaintext account numbers or other PII in log lines.

---

## 3. Implementation Notes

### Money / amounts
- Use `decimal.Decimal` for all monetary arithmetic — never `float`.
- Amounts are stored and compared as strings in message envelopes (`"amount": "1500.00"`); convert to `Decimal` only for arithmetic, then serialize back to a 2-decimal-place string.
- Use `ROUND_HALF_UP` rounding mode for any division or conversion.

### Currency
- Validate against the canonical ISO 4217 set. The complete list is large; at minimum validate against the ~170 active alphabetic codes. Any code not in the set (e.g. `"XYZ"`) causes immediate rejection.

### Timestamps / logging
- All agent-generated timestamps use ISO 8601 UTC format: `YYYY-MM-DDTHH:MM:SSZ`.
- Log format: `[<ISO8601>] [<agent_name>] <transaction_id> — <outcome> (<detail>)`
- PII rule: mask account numbers to first three characters + asterisks, e.g. `ACC-***` in all log lines.

### File-based message envelope
Agents communicate through JSON files in `shared/`. The standard envelope is:

```json
{
  "message_id": "<uuid4>",
  "timestamp": "<ISO8601>",
  "source_agent": "<agent_name>",
  "target_agent": "<next_agent_name>",
  "message_type": "transaction",
  "data": { }
}
```

`data` carries the transaction fields plus any fields added by each agent (e.g. `status`, `risk_score`).

### Directory protocol
```
shared/
├── input/       ← integrator writes initial message files here
├── processing/  ← agent moves the file here while working on it
├── output/      ← agent writes its result file here for the next agent
└── results/     ← reporter writes final per-transaction JSON + summary + log
```

Each agent must: (1) move the file from `input/` (or `output/` of prior agent) to `processing/`, (2) process it, (3) write the result to `output/` (or `results/` for the reporter).

---

## 4. Context

**Beginning state**
- `sample-transactions.json` — 8 raw transaction records with the following notable cases:
  - TXN001: normal $1,500 USD transfer (baseline)
  - TXN002: $25,000 USD wire transfer (high-value flag)
  - TXN003: $9,999.99 USD transfer (near-threshold structuring pattern)
  - TXN004: €500 EUR transfer, API channel, 02:47 UTC (off-hours + cross-border)
  - TXN005: $75,000 USD wire transfer (very high-value flag)
  - TXN006: $200 **XYZ** currency → invalid ISO 4217 (rejected by validator)
  - TXN007: **−$100** GBP refund → negative amount (rejected by validator)
  - TXN008: $3,200 USD mobile transfer (normal)

**Ending state**
- `shared/results/TXN001.json` … `TXN008.json` — one result file per transaction
- `shared/results/pipeline_summary.json` — aggregate report
- `shared/results/pipeline.log` — full audit log
- Test coverage ≥ 90% across all agent modules and the integrator

---

## 5. Low-Level Tasks

---

### Task: Transaction Validator

```
Prompt: "Implement a Python module at agents/transaction_validator.py. It must
export a single function process_message(message: dict) -> dict. The function
validates the transaction in message['data'] against these rules:

Required fields: transaction_id, timestamp, source_account, destination_account,
amount, currency, transaction_type (all must be present and non-empty strings).

Amount rules: parse as decimal.Decimal; must be > 0; must have at most 2 decimal
places; reject negative or zero values.

Currency: must be a valid ISO 4217 alphabetic code (maintain a hardcoded set of
~170 active codes; reject 'XYZ' and any unknown code).

Account format: source_account and destination_account must match the regex
ACC-[A-Z0-9]{4} (four uppercase alphanumeric characters after the hyphen).

Timestamp: must parse as a valid ISO 8601 datetime.

transaction_type: must be one of transfer, wire_transfer, deposit, withdrawal,
refund, payment.

On success: return the message with data['status'] = 'validated' and
data['validation_errors'] = [].
On failure: return the message with data['status'] = 'rejected',
data['validation_errors'] = [list of reason strings], and target_agent set to
'reporter' (skip fraud detection).

Log each decision to stdout using the format:
[<ISO8601>] [transaction_validator] <transaction_id> — <status> (<first error or 'OK'>)
Mask account numbers to 'ACC-***' in all log output."
```

**File to CREATE**: `agents/transaction_validator.py`

**Function to CREATE**: `process_message(message: dict) -> dict`

**Details**:
- Checks 7 required fields for presence and non-empty value
- Converts amount to `decimal.Decimal`; rejects ≤ 0 or more than 2 decimal places
- Validates currency against ISO 4217 active codes set (at minimum: USD, EUR, GBP, JPY, CHF, CAD, AUD, CNY, HKD, SGD, SEK, NOK, DKK, NZD, MXN, BRL, INR, KRW, ZAR, TRY, and ~150 more)
- Validates account format with regex `^ACC-[A-Z0-9]{4}$`
- Validates ISO 8601 timestamp using `datetime.fromisoformat` (or equivalent)
- Routes invalid transactions directly to reporter (`target_agent = "reporter"`)
- Expected outcomes on sample data: TXN006 rejected (invalid currency XYZ), TXN007 rejected (negative amount), all others pass

---

### Task: Fraud Detector

```
Prompt: "Implement a Python module at agents/fraud_detector.py. It must export a
single function process_message(message: dict) -> dict. The function computes a
risk score for the validated transaction in message['data'] and must only be
called when data['status'] == 'validated'.

Scoring rules (additive, cap total at 100):

HIGH-VALUE AMOUNT (convert amount to USD equivalent using fixed rates below):
  +40 points if USD-equivalent amount >= 10,000
  +30 additional points (total +70 cumulative) if >= 50,000

STRUCTURING PATTERN:
  +25 points if USD-equivalent amount is in [9,000, 10,000) — amounts just below
  the $10,000 reporting threshold

OFF-HOURS:
  +20 points if the transaction timestamp (UTC) is between 22:00 and 06:00
  (i.e. hour < 6 or hour >= 22)

CROSS-BORDER:
  +15 points if metadata.country != 'US' (treat missing country as 'US')

AUTOMATED CHANNEL:
  +5 points if metadata.channel == 'api'

Fixed USD conversion rates (for scoring only — not stored in results):
  EUR: 1.08, GBP: 1.27, JPY: 0.0067, CHF: 1.11, CAD: 0.74, AUD: 0.65
  All others (including USD): 1.0

Risk levels:
  LOW    — score 0–29
  MEDIUM — score 30–69
  HIGH   — score >= 70

Return the message with data enriched by:
  risk_score: <int 0–100>
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  risk_flags: [list of strings describing which rules fired]
  status: 'reviewed'
  target_agent: 'reporter'

Log each decision:
[<ISO8601>] [fraud_detector] <transaction_id> — risk=<score> level=<level> flags=[<flags>]"
```

**File to CREATE**: `agents/fraud_detector.py`

**Function to CREATE**: `process_message(message: dict) -> dict`

**Details**:
- Converts amount to USD using fixed rates before applying thresholds
- Applies five independent scoring rules; scores are additive, total capped at 100
- Populates `risk_flags` with human-readable strings for each rule that fired (e.g. `"high_value: $25000.00 >= $10000"`, `"off_hours: 02:47 UTC"`)
- Expected outcomes on sample data:
  - TXN001: score=0, LOW
  - TXN002: score=40, MEDIUM (high-value $25k)
  - TXN003: score=25, LOW (structuring pattern $9,999.99)
  - TXN004: score=40, MEDIUM (off-hours +20, cross-border +15, api +5)
  - TXN005: score=70, HIGH (high-value +40, very high +30)
  - TXN008: score=0, LOW
- Does not modify TXN006/TXN007 (they are routed directly to reporter by validator)

---

### Task: Reporter

```
Prompt: "Implement a Python module at agents/reporter.py. It must export a single
function process_message(message: dict) -> dict. The reporter is the terminal
agent — it writes final results to shared/results/ and does not forward messages.

For each message received:
1. Write shared/results/<transaction_id>.json containing the full message envelope
   (all fields, including risk_score/risk_level/risk_flags for fraud-scored
   transactions, or validation_errors for rejected ones).
2. Append a line to shared/results/pipeline.log in the format:
   [<ISO8601>] [reporter] <transaction_id> — final_status=<status> risk=<level|N/A>
   Mask account numbers to 'ACC-***'.
3. Return the message with data['status'] updated to 'complete' (for validated) or
   'rejected' (unchanged).

After all messages are processed (called by integrator with generate_summary=True):
4. Write shared/results/pipeline_summary.json with:
   {
     'pipeline_run_timestamp': '<ISO8601>',
     'total_transactions': <int>,
     'valid_count': <int>,
     'rejected_count': <int>,
     'risk_distribution': {'LOW': <int>, 'MEDIUM': <int>, 'HIGH': <int>},
     'flagged_for_review': [<transaction_id strings with risk HIGH>],
     'rejection_reasons': {<transaction_id>: [<reason strings>]}
   }

Log each write:
[<ISO8601>] [reporter] <transaction_id> — written to shared/results/<transaction_id>.json"
```

**File to CREATE**: `agents/reporter.py`

**Function to CREATE**: `process_message(message: dict) -> dict`

**Details**:
- Uses `json.dumps` with `indent=2` for all output files
- Appends (not overwrites) the log file on each call
- `generate_summary=True` mode is triggered by the integrator after all transactions are processed; the reporter accumulates state across calls via a module-level list
- Expected outputs: 8 result JSON files, 1 summary JSON, 1 log file
- Summary on sample data: total=8, valid=6, rejected=2, HIGH=1 (TXN005), MEDIUM=2 (TXN002, TXN004), LOW=3 (TXN001, TXN003, TXN008), flagged_for_review=["TXN005"]
