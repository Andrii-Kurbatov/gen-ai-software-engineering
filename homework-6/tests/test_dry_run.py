"""Coverage tests for CLI helpers not exercised by the main unit tests."""

import json
import pytest
from pathlib import Path

from agents.transaction_validator import _dry_run
import integrator as integrator_module
import agents.reporter as reporter_module


SAMPLE_TRANSACTIONS = Path(__file__).parent.parent / "sample-transactions.json"


class TestValidatorDryRun:
    def test_dry_run_prints_header(self, tmp_path, capsys):
        txns = [
            {
                "transaction_id": "TXN001",
                "timestamp": "2026-03-16T09:00:00Z",
                "source_account": "ACC-1001",
                "destination_account": "ACC-2001",
                "amount": "1500.00",
                "currency": "USD",
                "transaction_type": "transfer",
            }
        ]
        f = tmp_path / "txns.json"
        f.write_text(json.dumps(txns))
        _dry_run(str(f))
        out = capsys.readouterr().out
        assert "TXN ID" in out
        assert "STATUS" in out

    def test_dry_run_valid_transaction(self, tmp_path, capsys):
        txns = [
            {
                "transaction_id": "TXN001",
                "timestamp": "2026-03-16T09:00:00Z",
                "source_account": "ACC-1001",
                "destination_account": "ACC-2001",
                "amount": "1500.00",
                "currency": "USD",
                "transaction_type": "transfer",
            }
        ]
        f = tmp_path / "txns.json"
        f.write_text(json.dumps(txns))
        _dry_run(str(f))
        out = capsys.readouterr().out
        assert "TXN001" in out
        assert "validated" in out

    def test_dry_run_rejected_transaction(self, tmp_path, capsys):
        txns = [
            {
                "transaction_id": "TXN006",
                "timestamp": "2026-03-16T10:05:00Z",
                "source_account": "ACC-1006",
                "destination_account": "ACC-7700",
                "amount": "200.00",
                "currency": "XYZ",
                "transaction_type": "transfer",
            }
        ]
        f = tmp_path / "txns.json"
        f.write_text(json.dumps(txns))
        _dry_run(str(f))
        out = capsys.readouterr().out
        assert "TXN006" in out
        assert "rejected" in out

    def test_dry_run_sample_file(self, capsys):
        _dry_run(str(SAMPLE_TRANSACTIONS))
        out = capsys.readouterr().out
        assert "TXN001" in out
        assert "TXN006" in out


class TestIntegratorWriteInput:
    def test_write_input_creates_file(self, tmp_path, monkeypatch):
        # Patch the shared/input path used inside _write_input
        input_dir = tmp_path / "shared" / "input"
        input_dir.mkdir(parents=True)
        original = integrator_module._write_input

        # Call by changing CWD so Path("shared/input") resolves to tmp_path
        monkeypatch.chdir(tmp_path)
        (tmp_path / "shared").mkdir(exist_ok=True)

        envelope = {
            "message_id": "test-uuid",
            "timestamp": "2026-03-16T09:00:00Z",
            "source_agent": "integrator",
            "target_agent": "transaction_validator",
            "message_type": "transaction",
            "data": {"transaction_id": "TXN001"},
        }
        integrator_module._write_input(envelope)
        assert (input_dir / "TXN001.json").exists()

    def test_write_input_falls_back_to_message_id(self, tmp_path, monkeypatch):
        input_dir = tmp_path / "shared" / "input"
        input_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)
        (tmp_path / "shared").mkdir(exist_ok=True)

        envelope = {
            "message_id": "fallback-id",
            "timestamp": "2026-03-16T09:00:00Z",
            "source_agent": "integrator",
            "target_agent": "transaction_validator",
            "message_type": "transaction",
            "data": {},
        }
        integrator_module._write_input(envelope)
        assert (input_dir / "fallback-id.json").exists()
