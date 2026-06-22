"""Unit tests for agents/reporter.py."""

import json
import copy
import pytest
from pathlib import Path

import agents.reporter as reporter_module
from agents.reporter import process_message, write_summary


# ---------------------------------------------------------------------------
# Fixtures — isolate file system and reset accumulator
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def isolated_reporter(tmp_path, monkeypatch):
    results_dir = tmp_path / "results"
    results_dir.mkdir()
    monkeypatch.setattr(reporter_module, "RESULTS_DIR", results_dir)
    monkeypatch.setattr(reporter_module, "LOG_FILE", results_dir / "pipeline.log")
    monkeypatch.setattr(reporter_module, "SUMMARY_FILE", results_dir / "pipeline_summary.json")
    monkeypatch.setattr(reporter_module, "_processed", [])
    return results_dir


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _reviewed_msg(txn_id="TXN001", risk_level="LOW", risk_score=0, status="reviewed"):
    return {
        "message_id": "test-msg-id",
        "timestamp": "2026-03-16T09:00:00Z",
        "source_agent": "fraud_detector",
        "target_agent": "reporter",
        "message_type": "transaction",
        "data": {
            "transaction_id": txn_id,
            "timestamp": "2026-03-16T09:00:00Z",
            "source_account": "ACC-1001",
            "destination_account": "ACC-2001",
            "amount": "1500.00",
            "currency": "USD",
            "transaction_type": "transfer",
            "status": status,
            "validation_errors": [],
            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_flags": [],
        },
    }


def _rejected_msg(txn_id="TXN006", errors=None):
    return {
        "message_id": "test-msg-id-2",
        "timestamp": "2026-03-16T10:05:00Z",
        "source_agent": "transaction_validator",
        "target_agent": "reporter",
        "message_type": "transaction",
        "data": {
            "transaction_id": txn_id,
            "timestamp": "2026-03-16T10:05:00Z",
            "source_account": "ACC-1006",
            "destination_account": "ACC-7700",
            "amount": "200.00",
            "currency": "XYZ",
            "transaction_type": "transfer",
            "status": "rejected",
            "validation_errors": errors or ["currency: 'XYZ' is not a valid ISO 4217 code"],
        },
    }


# ---------------------------------------------------------------------------
# File writing
# ---------------------------------------------------------------------------

class TestWriteResult:
    def test_creates_json_file(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        assert (isolated_reporter / "TXN001.json").exists()

    def test_json_file_is_valid(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        data = json.loads((isolated_reporter / "TXN001.json").read_text())
        assert isinstance(data, dict)

    def test_json_file_contains_transaction_id(self, isolated_reporter):
        process_message(_reviewed_msg("TXN002"))
        data = json.loads((isolated_reporter / "TXN002.json").read_text())
        assert data["data"]["transaction_id"] == "TXN002"

    def test_json_file_for_rejected(self, isolated_reporter):
        process_message(_rejected_msg("TXN006"))
        assert (isolated_reporter / "TXN006.json").exists()

    def test_accounts_masked_in_file(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        data = json.loads((isolated_reporter / "TXN001.json").read_text())
        assert data["data"]["source_account"] == "ACC-***"
        assert data["data"]["destination_account"] == "ACC-***"


# ---------------------------------------------------------------------------
# Log file
# ---------------------------------------------------------------------------

class TestLogFile:
    def test_log_file_created(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        assert (isolated_reporter / "pipeline.log").exists()

    def test_log_contains_txn_id(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        log = (isolated_reporter / "pipeline.log").read_text()
        assert "TXN001" in log

    def test_log_contains_status(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        log = (isolated_reporter / "pipeline.log").read_text()
        assert "final_status=" in log

    def test_log_appends_multiple_entries(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        process_message(_reviewed_msg("TXN002"))
        log = (isolated_reporter / "pipeline.log").read_text()
        assert log.count("[reporter]") == 2

    def test_log_contains_risk_level(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001", risk_level="MEDIUM", risk_score=40))
        log = (isolated_reporter / "pipeline.log").read_text()
        assert "MEDIUM" in log

    def test_log_rejected_shows_na(self, isolated_reporter):
        process_message(_rejected_msg("TXN006"))
        log = (isolated_reporter / "pipeline.log").read_text()
        assert "N/A" in log


# ---------------------------------------------------------------------------
# Status normalisation
# ---------------------------------------------------------------------------

class TestStatusNormalisation:
    def test_reviewed_becomes_complete(self, isolated_reporter):
        result = process_message(_reviewed_msg("TXN001", status="reviewed"))
        assert result["data"]["status"] == "complete"

    def test_validated_becomes_complete(self, isolated_reporter):
        msg = _reviewed_msg("TXN001", status="validated")
        result = process_message(msg)
        assert result["data"]["status"] == "complete"

    def test_rejected_stays_rejected(self, isolated_reporter):
        result = process_message(_rejected_msg("TXN006"))
        assert result["data"]["status"] == "rejected"


# ---------------------------------------------------------------------------
# Summary generation
# ---------------------------------------------------------------------------

class TestSummaryGeneration:
    def test_summary_file_created_on_flag(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"), generate_summary=True)
        assert (isolated_reporter / "pipeline_summary.json").exists()

    def test_summary_not_created_without_flag(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        assert not (isolated_reporter / "pipeline_summary.json").exists()

    def test_summary_total_count(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        process_message(_reviewed_msg("TXN002"))
        process_message(_rejected_msg("TXN006"), generate_summary=True)
        summary = json.loads((isolated_reporter / "pipeline_summary.json").read_text())
        assert summary["total_transactions"] == 3

    def test_summary_valid_rejected_counts(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"))
        process_message(_rejected_msg("TXN006"))
        process_message(_rejected_msg("TXN007", errors=["amount: must be positive"]),
                        generate_summary=True)
        summary = json.loads((isolated_reporter / "pipeline_summary.json").read_text())
        assert summary["valid_count"] == 1
        assert summary["rejected_count"] == 2

    def test_summary_risk_distribution(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001", risk_level="LOW"))
        process_message(_reviewed_msg("TXN002", risk_level="MEDIUM"))
        process_message(_reviewed_msg("TXN005", risk_level="HIGH"), generate_summary=True)
        summary = json.loads((isolated_reporter / "pipeline_summary.json").read_text())
        assert summary["risk_distribution"]["LOW"] == 1
        assert summary["risk_distribution"]["MEDIUM"] == 1
        assert summary["risk_distribution"]["HIGH"] == 1

    def test_summary_flagged_for_review(self, isolated_reporter):
        process_message(_reviewed_msg("TXN005", risk_level="HIGH", risk_score=70),
                        generate_summary=True)
        summary = json.loads((isolated_reporter / "pipeline_summary.json").read_text())
        assert "TXN005" in summary["flagged_for_review"]

    def test_summary_rejection_reasons(self, isolated_reporter):
        errors = ["currency: 'XYZ' is not a valid ISO 4217 code"]
        process_message(_rejected_msg("TXN006", errors=errors), generate_summary=True)
        summary = json.loads((isolated_reporter / "pipeline_summary.json").read_text())
        assert "TXN006" in summary["rejection_reasons"]
        assert summary["rejection_reasons"]["TXN006"] == errors

    def test_summary_has_timestamp(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001"), generate_summary=True)
        summary = json.loads((isolated_reporter / "pipeline_summary.json").read_text())
        assert "pipeline_run_timestamp" in summary

    def test_write_summary_standalone(self, isolated_reporter):
        # Populate accumulator manually then call write_summary directly
        process_message(_reviewed_msg("TXN001"))
        process_message(_rejected_msg("TXN006"))
        summary = write_summary()
        assert summary["total_transactions"] == 2
        assert summary["valid_count"] == 1
        assert summary["rejected_count"] == 1

    def test_low_risk_not_flagged(self, isolated_reporter):
        process_message(_reviewed_msg("TXN001", risk_level="LOW"), generate_summary=True)
        summary = json.loads((isolated_reporter / "pipeline_summary.json").read_text())
        assert "TXN001" not in summary["flagged_for_review"]
