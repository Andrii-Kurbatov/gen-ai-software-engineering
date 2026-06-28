"""Transaction Validator — Agent 1 of the pipeline.

Validates raw transaction records against field, amount, currency,
account-format, timestamp, and transaction-type rules.
"""

import re
import sys
import json
import argparse
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone

from agents.common import now_iso, mask_account

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_TRANSACTION_TYPES = {
    "transfer",
    "wire_transfer",
    "deposit",
    "withdrawal",
    "refund",
    "payment",
}

# Comprehensive ISO 4217 active alphabetic codes (~170)
ISO_4217_CURRENCIES = {
    "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
    "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
    "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
    "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP",
    "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD",
    "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS", "INR",
    "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF",
    "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL",
    "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR",
    "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR",
    "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR",
    "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD",
    "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SVC", "SYP", "SZL", "THB",
    "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX",
    "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XOF",
    "XPF", "YER", "ZAR", "ZMW", "ZWL",
}

ACCOUNT_RE = re.compile(r"^ACC-[A-Z0-9]{4}$")
REQUIRED_FIELDS = [
    "transaction_id",
    "timestamp",
    "source_account",
    "destination_account",
    "amount",
    "currency",
    "transaction_type",
]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate(data: dict) -> list[str]:
    """Return a list of error strings; empty list means valid."""
    errors: list[str] = []

    # Required fields — present and non-empty strings
    for field in REQUIRED_FIELDS:
        if field not in data or not str(data[field]).strip():
            errors.append(f"{field}: required field is missing or empty")

    if errors:
        return errors  # no point continuing if structural fields are missing

    # Amount
    try:
        amount = Decimal(str(data["amount"]))
        if amount <= 0:
            errors.append(f"amount: must be positive, got {data['amount']}")
        elif amount.as_tuple().exponent < -2:
            errors.append(
                f"amount: must have at most 2 decimal places, got {data['amount']}"
            )
    except InvalidOperation:
        errors.append(f"amount: not a valid number: {data['amount']!r}")

    # Currency
    if data["currency"].upper() not in ISO_4217_CURRENCIES:
        errors.append(
            f"currency: {data['currency']!r} is not a valid ISO 4217 code"
        )

    # Account format
    for field in ("source_account", "destination_account"):
        if not ACCOUNT_RE.match(str(data[field])):
            errors.append(
                f"{field}: must match ACC-[A-Z0-9]{{4}}, got {data[field]!r}"
            )

    # Timestamp
    ts = str(data["timestamp"])
    try:
        datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        errors.append(f"timestamp: not a valid ISO 8601 datetime: {ts!r}")

    # Transaction type
    if data["transaction_type"] not in VALID_TRANSACTION_TYPES:
        errors.append(
            f"transaction_type: {data['transaction_type']!r} is not one of "
            f"{sorted(VALID_TRANSACTION_TYPES)}"
        )

    return errors


def _log(txn_id: str, status: str, detail: str) -> None:
    print(
        f"[{now_iso()}] [transaction_validator] {txn_id} — {status} ({detail})"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def process_message(message: dict) -> dict:
    """Validate a transaction message envelope.

    Returns the message with data['status'] and data['validation_errors'] set.
    Invalid transactions have their target_agent redirected to 'reporter'.
    """
    result = dict(message)
    data = dict(result.get("data", {}))
    txn_id = data.get("transaction_id", "UNKNOWN")

    errors = _validate(data)

    src = mask_account(str(data.get("source_account", "")))
    dst = mask_account(str(data.get("destination_account", "")))

    if not errors:
        data["status"] = "validated"
        data["validation_errors"] = []
        result["source_agent"] = "transaction_validator"
        result["target_agent"] = "fraud_detector"
        result["data"] = data
        _log(txn_id, "validated", f"OK ({src} → {dst})")
    else:
        data["status"] = "rejected"
        data["validation_errors"] = errors
        result["source_agent"] = "transaction_validator"
        result["target_agent"] = "reporter"
        result["data"] = data
        _log(txn_id, "rejected", errors[0])

    return result


# ---------------------------------------------------------------------------
# --dry-run CLI
# ---------------------------------------------------------------------------

def _dry_run(transactions_path: str) -> None:
    with open(transactions_path) as f:
        transactions = json.load(f)

    header = f"{'TXN ID':<10}  {'STATUS':<10}  {'ERRORS'}"
    print(header)
    print("-" * 70)

    for txn in transactions:
        envelope = {
            "message_id": "dry-run",
            "timestamp": now_iso(),
            "source_agent": "integrator",
            "target_agent": "transaction_validator",
            "message_type": "transaction",
            "data": txn,
        }
        result = process_message(envelope)
        data = result["data"]
        txn_id = data.get("transaction_id", "?")
        status = data["status"]
        errs = data["validation_errors"]
        err_str = "; ".join(errs) if errs else "—"
        print(f"{txn_id:<10}  {status:<10}  {err_str}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transaction Validator dry-run")
    parser.add_argument(
        "--dry-run",
        metavar="FILE",
        default="sample-transactions.json",
        help="Path to JSON file with transactions (default: sample-transactions.json)",
    )
    args = parser.parse_args()
    _dry_run(args.dry_run)
