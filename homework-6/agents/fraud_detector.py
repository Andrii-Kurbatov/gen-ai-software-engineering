"""Fraud Detector — Agent 2 of the pipeline.
meow
Computes an additive risk score (0–100) for validated transactions
based on amount, timing, geography, and channel signals.
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone

from agents.common import now_iso

# ---------------------------------------------------------------------------
# Fixed USD conversion rates (scoring only — not stored in results)
# ---------------------------------------------------------------------------

_USD_RATES: dict[str, Decimal] = {
    "EUR": Decimal("1.08"),
    "GBP": Decimal("1.27"),
    "JPY": Decimal("0.0067"),
    "CHF": Decimal("1.11"),
    "CAD": Decimal("0.74"),
    "AUD": Decimal("0.65"),
}


def _to_usd(amount: Decimal, currency: str) -> Decimal:
    rate = _USD_RATES.get(currency.upper(), Decimal("1.0"))
    return (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _score(data: dict) -> tuple[int, list[str]]:
    """Return (risk_score capped at 100, list of flag strings)."""
    amount = Decimal(str(data["amount"]))
    currency = data.get("currency", "USD")
    usd_amount = _to_usd(amount, currency)

    metadata = data.get("metadata") or {}
    country = metadata.get("country") or "US"
    channel = metadata.get("channel") or ""

    ts_str = str(data.get("timestamp", ""))
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        hour = dt.hour
    except ValueError:
        hour = 12  # assume mid-day if unparseable

    score = 0
    flags: list[str] = []

    # High-value amount
    if usd_amount >= Decimal("50000"):
        score += 70
        flags.append(f"high_value: ${usd_amount:.2f} >= $50000 (very high)")
    elif usd_amount >= Decimal("10000"):
        score += 40
        flags.append(f"high_value: ${usd_amount:.2f} >= $10000")

    # Structuring pattern — just below $10k reporting threshold
    if Decimal("9000") <= usd_amount < Decimal("10000"):
        score += 25
        flags.append(f"structuring: ${usd_amount:.2f} in [$9000, $10000)")

    # Off-hours (UTC)
    if hour < 6 or hour >= 22:
        score += 20
        flags.append(f"off_hours: {hour:02d}:00 UTC")

    # Cross-border
    if country != "US":
        score += 15
        flags.append(f"cross_border: country={country}")

    # Automated API channel
    if channel.lower() == "api":
        score += 5
        flags.append("automated_channel: api")

    return min(score, 100), flags


def _risk_level(score: int) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def _log(txn_id: str, score: int, level: str, flags: list[str]) -> None:
    print(
        f"[{now_iso()}] [fraud_detector] {txn_id} — "
        f"risk={score} level={level} flags={flags}"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def process_message(message: dict) -> dict:
    """Score a validated transaction for fraud risk.

    Should only be called when message['data']['status'] == 'validated'.
    Returns the message enriched with risk_score, risk_level, risk_flags,
    status='reviewed', and target_agent='reporter'.
    """
    result = dict(message)
    data = dict(result.get("data", {}))
    txn_id = data.get("transaction_id", "UNKNOWN")

    score, flags = _score(data)
    level = _risk_level(score)

    data["risk_score"] = score
    data["risk_level"] = level
    data["risk_flags"] = flags
    data["status"] = "reviewed"

    result["source_agent"] = "fraud_detector"
    result["target_agent"] = "reporter"
    result["data"] = data

    _log(txn_id, score, level, flags)
    return result
