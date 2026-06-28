"""Tests for pipeline_mcp/server.py tools and resources."""

import json
import pytest

import pipeline_mcp.server as server_module
from pipeline_mcp.server import (
    get_transaction_status,
    list_pipeline_results,
    pipeline_summary,
)


# ---------------------------------------------------------------------------
# Fixture: isolated results directory
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def isolated_results(tmp_path, monkeypatch):
    results_dir = tmp_path / "results"
    results_dir.mkdir()
    monkeypatch.setattr(server_module, "RESULTS_DIR", results_dir)
    return results_dir


def _write_result(results_dir, txn_id, data_extra=None):
    data = {
        "transaction_id": txn_id,
        "status": "complete",
        "risk_level": "LOW",
        "risk_score": 0,
        "risk_flags": [],
        "validation_errors": [],
    }
    if data_extra:
        data.update(data_extra)
    envelope = {
        "message_id": f"msg-{txn_id}",
        "timestamp": "2026-03-16T09:00:00Z",
        "source_agent": "fraud_detector",
        "target_agent": "reporter",
        "message_type": "transaction",
        "data": data,
    }
    (results_dir / f"{txn_id}.json").write_text(json.dumps(envelope, indent=2))
    return envelope


# ---------------------------------------------------------------------------
# get_transaction_status
# ---------------------------------------------------------------------------

class TestGetTransactionStatus:
    def test_returns_result_for_known_txn(self, isolated_results):
        _write_result(isolated_results, "TXN001")
        result = get_transaction_status("TXN001")
        assert result["data"]["transaction_id"] == "TXN001"

    def test_returns_error_for_unknown_txn(self, isolated_results):
        result = get_transaction_status("TXN999")
        assert "error" in result
        assert "TXN999" in result["error"]

    def test_error_includes_available_list(self, isolated_results):
        _write_result(isolated_results, "TXN001")
        result = get_transaction_status("TXN999")
        assert "available" in result
        assert "TXN001" in result["available"]

    def test_full_envelope_returned(self, isolated_results):
        _write_result(isolated_results, "TXN002")
        result = get_transaction_status("TXN002")
        assert "message_id" in result
        assert "data" in result

    def test_returns_rejected_txn(self, isolated_results):
        _write_result(isolated_results, "TXN006", {
            "status": "rejected",
            "validation_errors": ["currency: 'XYZ' is not a valid ISO 4217 code"],
        })
        result = get_transaction_status("TXN006")
        assert result["data"]["status"] == "rejected"


# ---------------------------------------------------------------------------
# list_pipeline_results
# ---------------------------------------------------------------------------

class TestListPipelineResults:
    def test_empty_when_no_results(self, isolated_results):
        assert list_pipeline_results() == []

    def test_returns_one_entry_per_file(self, isolated_results):
        _write_result(isolated_results, "TXN001")
        _write_result(isolated_results, "TXN002")
        results = list_pipeline_results()
        assert len(results) == 2

    def test_entry_has_required_fields(self, isolated_results):
        _write_result(isolated_results, "TXN001")
        entry = list_pipeline_results()[0]
        assert "transaction_id" in entry
        assert "status" in entry
        assert "risk_level" in entry
        assert "risk_score" in entry

    def test_transaction_id_correct(self, isolated_results):
        _write_result(isolated_results, "TXN003")
        results = list_pipeline_results()
        assert results[0]["transaction_id"] == "TXN003"

    def test_sorted_order(self, isolated_results):
        _write_result(isolated_results, "TXN002")
        _write_result(isolated_results, "TXN001")
        results = list_pipeline_results()
        ids = [r["transaction_id"] for r in results]
        assert ids == sorted(ids)

    def test_validation_errors_included_for_rejected(self, isolated_results):
        errors = ["currency: 'XYZ' is not valid"]
        _write_result(isolated_results, "TXN006", {
            "status": "rejected",
            "validation_errors": errors,
        })
        results = list_pipeline_results()
        entry = next(r for r in results if r["transaction_id"] == "TXN006")
        assert "validation_errors" in entry
        assert entry["validation_errors"] == errors

    def test_unreadable_file_marked_as_error(self, isolated_results):
        (isolated_results / "TXN_BAD.json").write_text("not valid json{{")
        results = list_pipeline_results()
        # Non-TXN prefix files aren't picked up by glob("TXN*.json")
        # so let's write a properly named broken file
        (isolated_results / "TXN999.json").write_text("not valid json{{")
        results = list_pipeline_results()
        bad = next((r for r in results if r.get("transaction_id") == "TXN999"), None)
        assert bad is not None
        assert bad.get("error") == "unreadable"

    def test_no_validation_errors_field_for_valid(self, isolated_results):
        _write_result(isolated_results, "TXN001")  # validation_errors = []
        results = list_pipeline_results()
        entry = results[0]
        # Empty list → falsy → field should not be included
        assert "validation_errors" not in entry


# ---------------------------------------------------------------------------
# pipeline_summary resource
# ---------------------------------------------------------------------------

class TestPipelineSummaryResource:
    def test_error_when_no_summary(self, isolated_results):
        result_str = pipeline_summary()
        data = json.loads(result_str)
        assert "error" in data

    def test_returns_json_string_when_exists(self, isolated_results):
        summary = {
            "pipeline_run_timestamp": "2026-03-16T10:00:00Z",
            "total_transactions": 8,
            "valid_count": 6,
            "rejected_count": 2,
            "risk_distribution": {"LOW": 3, "MEDIUM": 2, "HIGH": 1},
            "flagged_for_review": ["TXN005"],
            "rejection_reasons": {
                "TXN006": ["currency: 'XYZ' is not valid"],
                "TXN007": ["amount: must be positive"],
            },
        }
        (isolated_results / "pipeline_summary.json").write_text(
            json.dumps(summary, indent=2)
        )
        result_str = pipeline_summary()
        parsed = json.loads(result_str)
        assert parsed["total_transactions"] == 8

    def test_returns_string_type(self, isolated_results):
        (isolated_results / "pipeline_summary.json").write_text(
            json.dumps({"total_transactions": 1})
        )
        result = pipeline_summary()
        assert isinstance(result, str)

    def test_summary_content_preserved(self, isolated_results):
        summary = {"flagged_for_review": ["TXN005"], "total_transactions": 8}
        (isolated_results / "pipeline_summary.json").write_text(json.dumps(summary))
        parsed = json.loads(pipeline_summary())
        assert parsed["flagged_for_review"] == ["TXN005"]
