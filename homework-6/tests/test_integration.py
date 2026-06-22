"""End-to-end integration test: full pipeline over sample-transactions.json."""

import json
from pathlib import Path

import pytest

import agents.reporter as reporter_module
import integrator as integrator_module


SAMPLE_TRANSACTIONS = Path(__file__).parent.parent / "sample-transactions.json"


@pytest.fixture()
def pipeline_env(tmp_path, monkeypatch):
    """Set up isolated shared/ directories and reset reporter state."""
    shared = tmp_path / "shared"
    for sub in ("input", "processing", "output", "results"):
        (shared / sub).mkdir(parents=True)

    results_dir = shared / "results"

    # Redirect reporter module-level paths
    monkeypatch.setattr(reporter_module, "RESULTS_DIR", results_dir)
    monkeypatch.setattr(reporter_module, "LOG_FILE", results_dir / "pipeline.log")
    monkeypatch.setattr(reporter_module, "SUMMARY_FILE", results_dir / "pipeline_summary.json")
    monkeypatch.setattr(reporter_module, "_processed", [])

    # Redirect integrator's SHARED_DIRS and _write_input to use tmp_path
    monkeypatch.setattr(integrator_module, "SHARED_DIRS", [
        shared / "input",
        shared / "processing",
        shared / "output",
        shared / "results",
    ])

    # Patch _write_input to write into tmp shared/input
    original_write_input = integrator_module._write_input
    def _patched_write_input(envelope):
        txn_id = envelope["data"].get("transaction_id", envelope["message_id"])
        path = shared / "input" / f"{txn_id}.json"
        with path.open("w") as f:
            json.dump(envelope, f, indent=2)
    monkeypatch.setattr(integrator_module, "_write_input", _patched_write_input)

    return results_dir


class TestFullPipeline:
    def test_runs_without_error(self, pipeline_env):
        totals = integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        assert isinstance(totals, dict)

    def test_produces_eight_result_files(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        result_files = sorted(pipeline_env.glob("TXN*.json"))
        assert len(result_files) == 8

    def test_all_transaction_ids_present(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        result_ids = {p.stem for p in pipeline_env.glob("TXN*.json")}
        expected = {f"TXN{i:03d}" for i in range(1, 9)}
        assert result_ids == expected

    def test_pipeline_summary_created(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        assert (pipeline_env / "pipeline_summary.json").exists()

    def test_pipeline_log_created(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        assert (pipeline_env / "pipeline.log").exists()

    def test_summary_total_count(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        summary = json.loads((pipeline_env / "pipeline_summary.json").read_text())
        assert summary["total_transactions"] == 8

    def test_summary_valid_rejected_counts(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        summary = json.loads((pipeline_env / "pipeline_summary.json").read_text())
        assert summary["valid_count"] == 6
        assert summary["rejected_count"] == 2

    def test_txn006_rejected_invalid_currency(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        data = json.loads((pipeline_env / "TXN006.json").read_text())
        assert data["data"]["status"] == "rejected"
        errors = data["data"].get("validation_errors", [])
        assert any("currency" in e for e in errors)

    def test_txn007_rejected_negative_amount(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        data = json.loads((pipeline_env / "TXN007.json").read_text())
        assert data["data"]["status"] == "rejected"
        errors = data["data"].get("validation_errors", [])
        assert any("amount" in e for e in errors)

    def test_txn005_high_risk(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        data = json.loads((pipeline_env / "TXN005.json").read_text())
        assert data["data"]["risk_level"] == "HIGH"
        assert data["data"]["risk_score"] == 70

    def test_txn005_flagged_for_review_in_summary(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        summary = json.loads((pipeline_env / "pipeline_summary.json").read_text())
        assert "TXN005" in summary["flagged_for_review"]

    def test_txn001_complete_low_risk(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        data = json.loads((pipeline_env / "TXN001.json").read_text())
        assert data["data"]["status"] == "complete"
        assert data["data"]["risk_level"] == "LOW"
        assert data["data"]["risk_score"] == 0

    def test_txn002_medium_risk(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        data = json.loads((pipeline_env / "TXN002.json").read_text())
        assert data["data"]["risk_level"] == "MEDIUM"
        assert data["data"]["risk_score"] == 40

    def test_txn003_structuring_low(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        data = json.loads((pipeline_env / "TXN003.json").read_text())
        assert data["data"]["risk_score"] == 25
        assert data["data"]["risk_level"] == "LOW"

    def test_txn004_medium_risk_off_hours(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        data = json.loads((pipeline_env / "TXN004.json").read_text())
        assert data["data"]["risk_level"] == "MEDIUM"
        assert data["data"]["risk_score"] == 40

    def test_accounts_masked_in_results(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        for path in pipeline_env.glob("TXN*.json"):
            data = json.loads(path.read_text())
            txn_data = data.get("data", {})
            for field in ("source_account", "destination_account"):
                if field in txn_data:
                    assert txn_data[field] == "ACC-***", (
                        f"{path.name}: {field} not masked: {txn_data[field]!r}"
                    )

    def test_summary_risk_distribution(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        summary = json.loads((pipeline_env / "pipeline_summary.json").read_text())
        dist = summary["risk_distribution"]
        # TXN001, TXN003, TXN008 → LOW (3)
        # TXN002, TXN004 → MEDIUM (2)
        # TXN005 → HIGH (1)
        assert dist["LOW"] == 3
        assert dist["MEDIUM"] == 2
        assert dist["HIGH"] == 1

    def test_summary_rejection_reasons_included(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        summary = json.loads((pipeline_env / "pipeline_summary.json").read_text())
        assert "TXN006" in summary["rejection_reasons"]
        assert "TXN007" in summary["rejection_reasons"]

    def test_return_value_totals(self, pipeline_env):
        totals = integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        assert totals["total"] == 8
        assert totals["valid"] == 6
        assert totals["rejected"] == 2
        assert totals["HIGH"] == 1
        assert totals["MEDIUM"] == 2
        assert totals["LOW"] == 3

    def test_log_has_eight_entries(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        log_text = (pipeline_env / "pipeline.log").read_text()
        lines = [l for l in log_text.splitlines() if l.strip()]
        assert len(lines) == 8

    def test_log_no_plaintext_accounts(self, pipeline_env):
        integrator_module.run_pipeline(str(SAMPLE_TRANSACTIONS))
        log_text = (pipeline_env / "pipeline.log").read_text()
        # Real account numbers like ACC-1001 should not appear in log
        import re
        real_accounts = re.findall(r"ACC-[A-Z0-9]{4}", log_text)
        assert real_accounts == [], f"Unmasked accounts in log: {real_accounts}"
