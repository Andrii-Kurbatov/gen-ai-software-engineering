"""Integrator — pipeline orchestrator.

Loads sample-transactions.json, wraps each record in a message envelope,
routes it through validator → (fraud_detector) → reporter, then prints a
summary table.
"""

import json
import sys
from pathlib import Path

from agents.common import make_envelope, now_iso
from agents import transaction_validator, fraud_detector, reporter

SAMPLE_FILE = Path("sample-transactions.json")
SHARED_DIRS = [
    Path("shared/input"),
    Path("shared/processing"),
    Path("shared/output"),
    Path("shared/results"),
]


def _setup_dirs() -> None:
    for d in SHARED_DIRS:
        d.mkdir(parents=True, exist_ok=True)


def _write_input(envelope: dict) -> None:
    txn_id = envelope["data"].get("transaction_id", envelope["message_id"])
    path = Path("shared/input") / f"{txn_id}.json"
    with path.open("w") as f:
        json.dump(envelope, f, indent=2)


def run_pipeline(transactions_path: str = str(SAMPLE_FILE)) -> dict:
    _setup_dirs()

    with open(transactions_path) as f:
        transactions = json.load(f)

    print(f"[{now_iso()}] [integrator] loaded {len(transactions)} transactions")

    results: list[dict] = []

    for txn in transactions:
        # 1. Create the initial message envelope
        envelope = make_envelope(
            source_agent="integrator",
            target_agent="transaction_validator",
            data=dict(txn),
        )

        # 2. Persist raw input message for audit
        _write_input(envelope)

        # 3. Validate
        validated = transaction_validator.process_message(envelope)

        # 4. Fraud detection — only for validated transactions
        if validated["data"]["status"] == "validated":
            scored = fraud_detector.process_message(validated)
        else:
            scored = validated  # rejected — skip fraud detection

        # 5. Report (last transaction triggers summary generation)
        is_last = txn is transactions[-1]
        final = reporter.process_message(scored, generate_summary=is_last)
        results.append(final)

    return _print_summary(results)


def _print_summary(results: list[dict]) -> dict:
    print()
    print("=" * 72)
    print(f"{'TXN ID':<10}  {'STATUS':<12}  {'RISK':<8}  {'SCORE':<6}  FLAGS")
    print("-" * 72)

    totals = {"total": 0, "valid": 0, "rejected": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}

    for msg in results:
        data = msg.get("data", {})
        txn_id = data.get("transaction_id", "?")
        status = data.get("status", "?")
        risk = data.get("risk_level", "N/A")
        score = data.get("risk_score", "—")
        flags = "; ".join(data.get("risk_flags", [])) or "—"

        print(f"{txn_id:<10}  {status:<12}  {risk:<8}  {str(score):<6}  {flags}")

        totals["total"] += 1
        if status == "rejected":
            totals["rejected"] += 1
        else:
            totals["valid"] += 1
            if risk in totals:
                totals[risk] += 1

    print("=" * 72)
    print(
        f"Total: {totals['total']}  Valid: {totals['valid']}  "
        f"Rejected: {totals['rejected']}  "
        f"HIGH: {totals['HIGH']}  MEDIUM: {totals['MEDIUM']}  LOW: {totals['LOW']}"
    )
    print()
    return totals


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else str(SAMPLE_FILE)
    run_pipeline(path)
