"""Unit tests for agents/fraud_detector.py."""

import copy
import pytest

from agents.fraud_detector import process_message, _to_usd, _risk_level, _score
from decimal import Decimal


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE_DATA = {
    "transaction_id": "TXN001",
    "timestamp": "2026-03-16T09:00:00Z",
    "source_account": "ACC-1001",
    "destination_account": "ACC-2001",
    "amount": "1500.00",
    "currency": "USD",
    "transaction_type": "transfer",
    "status": "validated",
    "metadata": {"channel": "online", "country": "US"},
}


def make_message(data_overrides=None):
    data = copy.deepcopy(BASE_DATA)
    if data_overrides:
        data.update(data_overrides)
    return {
        "message_id": "test-msg-id",
        "timestamp": "2026-03-16T09:00:00Z",
        "source_agent": "transaction_validator",
        "target_agent": "fraud_detector",
        "message_type": "transaction",
        "data": data,
    }


# ---------------------------------------------------------------------------
# USD conversion helper
# ---------------------------------------------------------------------------

class TestToUsd:
    @pytest.mark.parametrize("currency,rate", [
        ("EUR", "1.08"),
        ("GBP", "1.27"),
        ("JPY", "0.0067"),
        ("CHF", "1.11"),
        ("CAD", "0.74"),
        ("AUD", "0.65"),
    ])
    def test_known_currencies(self, currency, rate):
        result = _to_usd(Decimal("1000"), currency)
        expected = (Decimal("1000") * Decimal(rate)).quantize(Decimal("0.01"))
        assert result == expected

    def test_usd_no_conversion(self):
        assert _to_usd(Decimal("1000"), "USD") == Decimal("1000.00")

    def test_unknown_currency_defaults_to_1(self):
        assert _to_usd(Decimal("500"), "XXX") == Decimal("500.00")

    def test_lowercase_currency(self):
        result = _to_usd(Decimal("1000"), "eur")
        assert result == Decimal("1080.00")


# ---------------------------------------------------------------------------
# Risk level mapping
# ---------------------------------------------------------------------------

class TestRiskLevel:
    def test_zero_is_low(self):
        assert _risk_level(0) == "LOW"

    def test_29_is_low(self):
        assert _risk_level(29) == "LOW"

    def test_30_is_medium(self):
        assert _risk_level(30) == "MEDIUM"

    def test_69_is_medium(self):
        assert _risk_level(69) == "MEDIUM"

    def test_70_is_high(self):
        assert _risk_level(70) == "HIGH"

    def test_100_is_high(self):
        assert _risk_level(100) == "HIGH"


# ---------------------------------------------------------------------------
# Scoring rules
# ---------------------------------------------------------------------------

class TestScoringRules:
    def test_baseline_low_score(self):
        score, flags = _score(BASE_DATA)
        assert score == 0
        assert flags == []

    def test_high_value_10k_adds_40(self):
        data = copy.deepcopy(BASE_DATA)
        data["amount"] = "10000.00"
        score, flags = _score(data)
        assert score == 40
        assert any("high_value" in f for f in flags)

    def test_high_value_50k_adds_70(self):
        data = copy.deepcopy(BASE_DATA)
        data["amount"] = "50000.00"
        score, flags = _score(data)
        assert score == 70
        assert any("50000" in f for f in flags)

    def test_structuring_9000_adds_25(self):
        data = copy.deepcopy(BASE_DATA)
        data["amount"] = "9000.00"
        score, flags = _score(data)
        assert score == 25
        assert any("structuring" in f for f in flags)

    def test_structuring_9999_99_adds_25(self):
        data = copy.deepcopy(BASE_DATA)
        data["amount"] = "9999.99"
        score, flags = _score(data)
        assert score == 25
        assert any("structuring" in f for f in flags)

    def test_structuring_exact_10k_not_triggered(self):
        # $10,000 exactly is high_value, not structuring
        data = copy.deepcopy(BASE_DATA)
        data["amount"] = "10000.00"
        score, flags = _score(data)
        assert not any("structuring" in f for f in flags)

    def test_off_hours_before_6am(self):
        data = copy.deepcopy(BASE_DATA)
        data["timestamp"] = "2026-03-16T02:47:00Z"
        score, flags = _score(data)
        assert score == 20
        assert any("off_hours" in f for f in flags)

    def test_off_hours_at_22(self):
        data = copy.deepcopy(BASE_DATA)
        data["timestamp"] = "2026-03-16T22:00:00Z"
        score, flags = _score(data)
        assert score == 20
        assert any("off_hours" in f for f in flags)

    def test_daytime_not_off_hours(self):
        data = copy.deepcopy(BASE_DATA)
        data["timestamp"] = "2026-03-16T12:00:00Z"
        score, flags = _score(data)
        assert not any("off_hours" in f for f in flags)

    def test_cross_border_adds_15(self):
        data = copy.deepcopy(BASE_DATA)
        data["metadata"] = {"channel": "online", "country": "DE"}
        score, flags = _score(data)
        assert score == 15
        assert any("cross_border" in f for f in flags)

    def test_us_country_no_cross_border(self):
        score, flags = _score(BASE_DATA)
        assert not any("cross_border" in f for f in flags)

    def test_missing_country_treated_as_us(self):
        data = copy.deepcopy(BASE_DATA)
        data["metadata"] = {"channel": "online"}
        score, flags = _score(data)
        assert not any("cross_border" in f for f in flags)

    def test_api_channel_adds_5(self):
        data = copy.deepcopy(BASE_DATA)
        data["metadata"] = {"channel": "api", "country": "US"}
        score, flags = _score(data)
        assert score == 5
        assert any("automated_channel" in f for f in flags)

    def test_non_api_channel_no_flag(self):
        data = copy.deepcopy(BASE_DATA)
        data["metadata"] = {"channel": "branch", "country": "US"}
        score, flags = _score(data)
        assert not any("automated_channel" in f for f in flags)

    def test_score_capped_at_100(self):
        # Very high amount + off hours + cross border + api — would exceed 100
        data = copy.deepcopy(BASE_DATA)
        data["amount"] = "75000.00"
        data["timestamp"] = "2026-03-16T02:00:00Z"  # off-hours +20
        data["metadata"] = {"channel": "api", "country": "DE"}
        score, flags = _score(data)
        assert score == 100

    def test_missing_metadata_no_crash(self):
        data = copy.deepcopy(BASE_DATA)
        del data["metadata"]
        score, flags = _score(data)
        assert score == 0  # baseline, no flags

    def test_invalid_timestamp_defaults_to_midday(self):
        data = copy.deepcopy(BASE_DATA)
        data["timestamp"] = "not-a-date"
        score, flags = _score(data)
        assert not any("off_hours" in f for f in flags)


# ---------------------------------------------------------------------------
# Currency conversion in scoring
# ---------------------------------------------------------------------------

class TestCurrencyConversionScoring:
    def test_eur_500_not_high_value(self):
        # 500 EUR * 1.08 = 540 USD — below $10k threshold
        data = copy.deepcopy(BASE_DATA)
        data["amount"] = "500.00"
        data["currency"] = "EUR"
        score, flags = _score(data)
        assert not any("high_value" in f for f in flags)

    def test_gbp_10000_is_high_value(self):
        # 10000 GBP * 1.27 = 12700 USD — above $10k
        data = copy.deepcopy(BASE_DATA)
        data["amount"] = "10000.00"
        data["currency"] = "GBP"
        score, flags = _score(data)
        assert any("high_value" in f for f in flags)


# ---------------------------------------------------------------------------
# process_message output shape
# ---------------------------------------------------------------------------

class TestProcessMessage:
    def test_returns_dict(self):
        result = process_message(make_message())
        assert isinstance(result, dict)

    def test_status_set_to_reviewed(self):
        result = process_message(make_message())
        assert result["data"]["status"] == "reviewed"

    def test_target_agent_set_to_reporter(self):
        result = process_message(make_message())
        assert result["target_agent"] == "reporter"

    def test_source_agent_set(self):
        result = process_message(make_message())
        assert result["source_agent"] == "fraud_detector"

    def test_risk_score_is_int(self):
        result = process_message(make_message())
        assert isinstance(result["data"]["risk_score"], int)

    def test_risk_level_is_string(self):
        result = process_message(make_message())
        assert result["data"]["risk_level"] in ("LOW", "MEDIUM", "HIGH")

    def test_risk_flags_is_list(self):
        result = process_message(make_message())
        assert isinstance(result["data"]["risk_flags"], list)

    def test_original_data_preserved(self):
        result = process_message(make_message())
        assert result["data"]["transaction_id"] == "TXN001"
        assert result["data"]["amount"] == "1500.00"


# ---------------------------------------------------------------------------
# Sample transaction expected outcomes (from spec)
# ---------------------------------------------------------------------------

class TestSampleTransactionOutcomes:
    def _make(self, txn_data):
        return {
            "message_id": "test",
            "timestamp": "2026-03-16T09:00:00Z",
            "source_agent": "transaction_validator",
            "target_agent": "fraud_detector",
            "message_type": "transaction",
            "data": dict(txn_data, status="validated"),
        }

    def test_txn001_score_0_low(self):
        txn = {
            "transaction_id": "TXN001", "timestamp": "2026-03-16T09:00:00Z",
            "source_account": "ACC-1001", "destination_account": "ACC-2001",
            "amount": "1500.00", "currency": "USD", "transaction_type": "transfer",
            "metadata": {"channel": "online", "country": "US"},
        }
        result = process_message(self._make(txn))
        assert result["data"]["risk_score"] == 0
        assert result["data"]["risk_level"] == "LOW"

    def test_txn002_score_40_medium(self):
        txn = {
            "transaction_id": "TXN002", "timestamp": "2026-03-16T09:15:00Z",
            "source_account": "ACC-1002", "destination_account": "ACC-3001",
            "amount": "25000.00", "currency": "USD", "transaction_type": "wire_transfer",
            "metadata": {"channel": "branch", "country": "US"},
        }
        result = process_message(self._make(txn))
        assert result["data"]["risk_score"] == 40
        assert result["data"]["risk_level"] == "MEDIUM"

    def test_txn003_score_25_low_structuring(self):
        txn = {
            "transaction_id": "TXN003", "timestamp": "2026-03-16T09:30:00Z",
            "source_account": "ACC-1003", "destination_account": "ACC-9999",
            "amount": "9999.99", "currency": "USD", "transaction_type": "transfer",
            "metadata": {"channel": "online", "country": "US"},
        }
        result = process_message(self._make(txn))
        assert result["data"]["risk_score"] == 25
        assert result["data"]["risk_level"] == "LOW"

    def test_txn004_score_40_medium(self):
        # off-hours(+20) + cross-border(+15) + api(+5) = 40
        txn = {
            "transaction_id": "TXN004", "timestamp": "2026-03-16T02:47:00Z",
            "source_account": "ACC-1004", "destination_account": "ACC-5500",
            "amount": "500.00", "currency": "EUR", "transaction_type": "transfer",
            "metadata": {"channel": "api", "country": "DE"},
        }
        result = process_message(self._make(txn))
        assert result["data"]["risk_score"] == 40
        assert result["data"]["risk_level"] == "MEDIUM"

    def test_txn005_score_70_high(self):
        txn = {
            "transaction_id": "TXN005", "timestamp": "2026-03-16T10:00:00Z",
            "source_account": "ACC-1005", "destination_account": "ACC-6600",
            "amount": "75000.00", "currency": "USD", "transaction_type": "wire_transfer",
            "metadata": {"channel": "branch", "country": "US"},
        }
        result = process_message(self._make(txn))
        assert result["data"]["risk_score"] == 70
        assert result["data"]["risk_level"] == "HIGH"

    def test_txn008_score_0_low(self):
        txn = {
            "transaction_id": "TXN008", "timestamp": "2026-03-16T10:15:00Z",
            "source_account": "ACC-1008", "destination_account": "ACC-9900",
            "amount": "3200.00", "currency": "USD", "transaction_type": "transfer",
            "metadata": {"channel": "mobile", "country": "US"},
        }
        result = process_message(self._make(txn))
        assert result["data"]["risk_score"] == 0
        assert result["data"]["risk_level"] == "LOW"
