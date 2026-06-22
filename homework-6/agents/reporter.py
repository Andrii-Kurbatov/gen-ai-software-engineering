"""Reporter — terminal Agent 3 of the pipeline.

Writes per-transaction JSON results to shared/results/, appends to pipeline.log,
and generates pipeline_summary.json after all transactions are processed.
"""

import json
import os
from pathlib import Path

from agents.common import now_iso, mask_account

RESULTS_DIR = Path("shared/results")
LOG_FILE = RESULTS_DIR / "pipeline.log"
SUMMARY_FILE = RESULTS_DIR / "pipeline_summary.json"

# Module-level accumulator — collects every processed message for the summary.
_processed: list[dict] = []


def _log_line(txn_id: str, status: str, risk: str) -> None:
    line = (
        f"[{now_iso()}] [reporter] {txn_id} — "
        f"final_status={status} risk={risk}"
    )
    print(line)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a") as f:
        f.write(line + "\n")


def _write_result(txn_id: str, message: dict) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RESULTS_DIR / f"{txn_id}.json"
    with out_path.open("w") as f:
        json.dump(message, f, indent=2)
    ts = now_iso()
    print(
        f"[{ts}] [reporter] {txn_id} — written to shared/results/{txn_id}.json"
    )


def write_summary() -> dict:
    """Build and write pipeline_summary.json from all accumulated results."""
    total = len(_processed)
    valid_count = 0
    rejected_count = 0
    risk_dist: dict[str, int] = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
    flagged: list[str] = []
    rejection_reasons: dict[str, list[str]] = {}

    for msg in _processed:
        data = msg.get("data", {})
        txn_id = data.get("transaction_id", "UNKNOWN")
        status = data.get("status", "")

        if status == "rejected":
            rejected_count += 1
            rejection_reasons[txn_id] = data.get("validation_errors", [])
        else:
            valid_count += 1
            level = data.get("risk_level")
            if level in risk_dist:
                risk_dist[level] += 1
            if level == "HIGH":
                flagged.append(txn_id)

    summary = {
        "pipeline_run_timestamp": now_iso(),
        "total_transactions": total,
        "valid_count": valid_count,
        "rejected_count": rejected_count,
        "risk_distribution": risk_dist,
        "flagged_for_review": flagged,
        "rejection_reasons": rejection_reasons,
    }

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with SUMMARY_FILE.open("w") as f:
        json.dump(summary, f, indent=2)

    print(f"[{now_iso()}] [reporter] pipeline_summary.json written")
    return summary


def process_message(message: dict, generate_summary: bool = False) -> dict:
    """Write the transaction result to shared/results/ and append to the log.

    When generate_summary=True, also writes pipeline_summary.json.
    """
    result = dict(message)
    data = dict(result.get("data", {}))
    txn_id = data.get("transaction_id", "UNKNOWN")
    status = data.get("status", "unknown")

    # Mask accounts in the copy written to disk
    safe_data = dict(data)
    for field in ("source_account", "destination_account"):
        if field in safe_data:
            safe_data[field] = mask_account(str(safe_data[field]))

    safe_message = dict(result)
    safe_message["data"] = safe_data

    # Normalise terminal status
    if status in ("reviewed", "validated"):
        data["status"] = "complete"
        safe_data["status"] = "complete"
    # 'rejected' stays as-is

    result["data"] = data

    risk = data.get("risk_level", "N/A")
    _write_result(txn_id, safe_message)
    _log_line(txn_id, data["status"], risk)

    _processed.append(result)

    if generate_summary:
        write_summary()

    return result
