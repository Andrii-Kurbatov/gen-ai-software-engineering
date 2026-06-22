"""FastMCP server — Banking Pipeline status tools and resources.

Exposes:
  tool  get_transaction_status(transaction_id)  → per-transaction result
  tool  list_pipeline_results()                 → all result summaries
  resource  pipeline://summary                  → pipeline_summary.json

Run: python pipeline_mcp/server.py
"""

import json
from pathlib import Path

from fastmcp import FastMCP

RESULTS_DIR = Path("shared/results")

mcp = FastMCP(name="Banking Pipeline Status")


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool
def get_transaction_status(transaction_id: str) -> dict:
    """Get the full processing result for a single transaction.

    Args:
        transaction_id: The transaction ID (e.g. 'TXN001').

    Returns a dict with the complete message envelope including validation
    status, risk score, and risk flags (where applicable).
    """
    path = RESULTS_DIR / f"{transaction_id}.json"
    if not path.exists():
        return {
            "error": f"No result found for transaction_id={transaction_id!r}",
            "available": [p.stem for p in sorted(RESULTS_DIR.glob("TXN*.json"))],
        }
    with path.open() as f:
        return json.load(f)


@mcp.tool
def list_pipeline_results() -> list:
    """List a summary of all processed transactions.

    Returns a list of dicts, each with transaction_id, status, risk_level,
    and risk_score (or validation_errors for rejected transactions).
    """
    results = []
    for path in sorted(RESULTS_DIR.glob("TXN*.json")):
        try:
            with path.open() as f:
                envelope = json.load(f)
            data = envelope.get("data", {})
            entry: dict = {
                "transaction_id": data.get("transaction_id", path.stem),
                "status": data.get("status"),
                "risk_level": data.get("risk_level", "N/A"),
                "risk_score": data.get("risk_score", None),
            }
            if data.get("validation_errors"):
                entry["validation_errors"] = data["validation_errors"]
            results.append(entry)
        except (json.JSONDecodeError, OSError):
            results.append({"transaction_id": path.stem, "error": "unreadable"})
    return results


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------

@mcp.resource("pipeline://summary")
def pipeline_summary() -> str:
    """Pipeline summary report (pipeline_summary.json).

    Returns the JSON content of shared/results/pipeline_summary.json as a
    string. Run the pipeline first (python integrator.py) to generate it.
    """
    path = RESULTS_DIR / "pipeline_summary.json"
    if not path.exists():
        return json.dumps(
            {"error": "pipeline_summary.json not found — run integrator.py first"},
            indent=2,
        )
    with path.open() as f:
        return f.read()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run()
