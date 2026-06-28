import uuid
from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def mask_account(account: str) -> str:
    """Return ACC-*** for any ACC-XXXX value (no PII in logs)."""
    if account and account.startswith("ACC-"):
        return "ACC-***"
    return "***"


def make_envelope(
    source_agent: str,
    target_agent: str,
    data: dict,
    message_type: str = "transaction",
) -> dict:
    return {
        "message_id": str(uuid.uuid4()),
        "timestamp": now_iso(),
        "source_agent": source_agent,
        "target_agent": target_agent,
        "message_type": message_type,
        "data": data,
    }
