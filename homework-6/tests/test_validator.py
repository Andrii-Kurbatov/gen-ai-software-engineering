"""Unit tests for agents/transaction_validator.py."""

import copy
import pytest

from agents.transaction_validator import process_message


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE_TXN = {
    "transaction_id": "TXN001",
    "timestamp": "2026-03-16T09:00:00Z",
    "source_account": "ACC-1001",
    "destination_account": "ACC-2001",
    "amount": "1500.00",
    "currency": "USD",
    "transaction_type": "transfer",
}


def make_message(data_overrides=None):
    data = copy.deepcopy(BASE_TXN)
    if data_overrides:
        data.update(data_overrides)
    return {
        "message_id": "test-msg-id",
        "timestamp": "2026-03-16T09:00:00Z",
        "source_agent": "integrator",
        "target_agent": "transaction_validator",
        "message_type": "transaction",
        "data": data,
    }


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

class TestValidTransaction:
    def test_status_validated(self):
        result = process_message(make_message())
        assert result["data"]["status"] == "validated"

    def test_no_validation_errors(self):
        result = process_message(make_message())
        assert result["data"]["validation_errors"] == []

    def test_routed_to_fraud_detector(self):
        result = process_message(make_message())
        assert result["target_agent"] == "fraud_detector"

    def test_source_agent_updated(self):
        result = process_message(make_message())
        assert result["source_agent"] == "transaction_validator"

    def test_all_valid_transaction_types(self):
        valid_types = ["transfer", "wire_transfer", "deposit", "withdrawal", "refund", "payment"]
        for txn_type in valid_types:
            msg = make_message({"transaction_type": txn_type})
            result = process_message(msg)
            assert result["data"]["status"] == "validated", f"Expected validated for type {txn_type!r}"


# ---------------------------------------------------------------------------
# Required field validation
# ---------------------------------------------------------------------------

class TestRequiredFields:
    @pytest.mark.parametrize("field", [
        "transaction_id", "timestamp", "source_account",
        "destination_account", "amount", "currency", "transaction_type",
    ])
    def test_missing_field_rejected(self, field):
        data = copy.deepcopy(BASE_TXN)
        del data[field]
        msg = {"message_id": "x", "timestamp": "2026-01-01T00:00:00Z",
               "source_agent": "integrator", "target_agent": "tv",
               "message_type": "transaction", "data": data}
        result = process_message(msg)
        assert result["data"]["status"] == "rejected"

    @pytest.mark.parametrize("field", [
        "transaction_id", "timestamp", "source_account",
        "destination_account", "amount", "currency", "transaction_type",
    ])
    def test_empty_field_rejected(self, field):
        result = process_message(make_message({field: ""}))
        assert result["data"]["status"] == "rejected"

    @pytest.mark.parametrize("field", [
        "transaction_id", "timestamp", "source_account",
        "destination_account", "amount", "currency", "transaction_type",
    ])
    def test_whitespace_field_rejected(self, field):
        result = process_message(make_message({field: "   "}))
        assert result["data"]["status"] == "rejected"

    def test_missing_field_routed_to_reporter(self):
        data = copy.deepcopy(BASE_TXN)
        del data["transaction_id"]
        msg = {"message_id": "x", "timestamp": "2026-01-01T00:00:00Z",
               "source_agent": "integrator", "target_agent": "tv",
               "message_type": "transaction", "data": data}
        result = process_message(msg)
        assert result["target_agent"] == "reporter"


# ---------------------------------------------------------------------------
# Amount validation
# ---------------------------------------------------------------------------

class TestAmountValidation:
    def test_negative_amount_rejected(self):
        result = process_message(make_message({"amount": "-100.00"}))
        assert result["data"]["status"] == "rejected"

    def test_zero_amount_rejected(self):
        result = process_message(make_message({"amount": "0.00"}))
        assert result["data"]["status"] == "rejected"

    def test_too_many_decimal_places_rejected(self):
        result = process_message(make_message({"amount": "100.001"}))
        assert result["data"]["status"] == "rejected"

    def test_non_numeric_amount_rejected(self):
        result = process_message(make_message({"amount": "abc"}))
        assert result["data"]["status"] == "rejected"

    def test_two_decimal_places_accepted(self):
        result = process_message(make_message({"amount": "100.99"}))
        assert result["data"]["status"] == "validated"

    def test_one_decimal_place_accepted(self):
        result = process_message(make_message({"amount": "100.5"}))
        assert result["data"]["status"] == "validated"

    def test_integer_amount_accepted(self):
        result = process_message(make_message({"amount": "500"}))
        assert result["data"]["status"] == "validated"

    def test_very_small_positive_accepted(self):
        result = process_message(make_message({"amount": "0.01"}))
        assert result["data"]["status"] == "validated"


# ---------------------------------------------------------------------------
# Currency validation
# ---------------------------------------------------------------------------

class TestCurrencyValidation:
    def test_invalid_currency_xyz_rejected(self):
        result = process_message(make_message({"currency": "XYZ"}))
        assert result["data"]["status"] == "rejected"

    def test_lowercase_currency_accepted(self):
        # validator calls .upper() before checking
        result = process_message(make_message({"currency": "usd"}))
        assert result["data"]["status"] == "validated"

    @pytest.mark.parametrize("code", ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"])
    def test_common_currencies_accepted(self, code):
        result = process_message(make_message({"currency": code}))
        assert result["data"]["status"] == "validated"

    def test_fake_currency_rejected(self):
        result = process_message(make_message({"currency": "FOO"}))
        assert result["data"]["status"] == "rejected"


# ---------------------------------------------------------------------------
# Account format validation
# ---------------------------------------------------------------------------

class TestAccountFormat:
    @pytest.mark.parametrize("account_field", ["source_account", "destination_account"])
    def test_bad_format_rejected(self, account_field):
        result = process_message(make_message({account_field: "ACC-12"}))
        assert result["data"]["status"] == "rejected"

    @pytest.mark.parametrize("account_field", ["source_account", "destination_account"])
    def test_five_chars_rejected(self, account_field):
        result = process_message(make_message({account_field: "ACC-12345"}))
        assert result["data"]["status"] == "rejected"

    @pytest.mark.parametrize("account_field", ["source_account", "destination_account"])
    def test_lowercase_rejected(self, account_field):
        result = process_message(make_message({account_field: "acc-1234"}))
        assert result["data"]["status"] == "rejected"

    @pytest.mark.parametrize("account_field", ["source_account", "destination_account"])
    def test_missing_prefix_rejected(self, account_field):
        result = process_message(make_message({account_field: "1234"}))
        assert result["data"]["status"] == "rejected"

    def test_alphanumeric_four_chars_accepted(self):
        result = process_message(make_message({
            "source_account": "ACC-AB12",
            "destination_account": "ACC-CD34",
        }))
        assert result["data"]["status"] == "validated"


# ---------------------------------------------------------------------------
# Timestamp validation
# ---------------------------------------------------------------------------

class TestTimestampValidation:
    def test_invalid_timestamp_rejected(self):
        result = process_message(make_message({"timestamp": "not-a-date"}))
        assert result["data"]["status"] == "rejected"

    def test_valid_z_timestamp_accepted(self):
        result = process_message(make_message({"timestamp": "2026-03-16T09:00:00Z"}))
        assert result["data"]["status"] == "validated"

    def test_valid_offset_timestamp_accepted(self):
        result = process_message(make_message({"timestamp": "2026-03-16T09:00:00+00:00"}))
        assert result["data"]["status"] == "validated"


# ---------------------------------------------------------------------------
# Transaction type validation
# ---------------------------------------------------------------------------

class TestTransactionType:
    def test_invalid_type_rejected(self):
        result = process_message(make_message({"transaction_type": "unknown_type"}))
        assert result["data"]["status"] == "rejected"

    def test_errors_contain_description(self):
        result = process_message(make_message({"transaction_type": "invalid"}))
        errors = result["data"]["validation_errors"]
        assert any("transaction_type" in e for e in errors)


# ---------------------------------------------------------------------------
# Sample transaction cases from spec
# ---------------------------------------------------------------------------

class TestSampleTransactions:
    def _envelope(self, txn_data):
        return {
            "message_id": "test",
            "timestamp": "2026-03-16T09:00:00Z",
            "source_agent": "integrator",
            "target_agent": "transaction_validator",
            "message_type": "transaction",
            "data": txn_data,
        }

    def test_txn006_invalid_currency_rejected(self):
        txn = {
            "transaction_id": "TXN006", "timestamp": "2026-03-16T10:05:00Z",
            "source_account": "ACC-1006", "destination_account": "ACC-7700",
            "amount": "200.00", "currency": "XYZ", "transaction_type": "transfer",
        }
        result = process_message(self._envelope(txn))
        assert result["data"]["status"] == "rejected"
        assert result["target_agent"] == "reporter"

    def test_txn007_negative_amount_rejected(self):
        txn = {
            "transaction_id": "TXN007", "timestamp": "2026-03-16T10:10:00Z",
            "source_account": "ACC-1007", "destination_account": "ACC-8800",
            "amount": "-100.00", "currency": "GBP", "transaction_type": "refund",
        }
        result = process_message(self._envelope(txn))
        assert result["data"]["status"] == "rejected"
        assert result["target_agent"] == "reporter"

    def test_txn001_valid(self):
        txn = {
            "transaction_id": "TXN001", "timestamp": "2026-03-16T09:00:00Z",
            "source_account": "ACC-1001", "destination_account": "ACC-2001",
            "amount": "1500.00", "currency": "USD", "transaction_type": "transfer",
        }
        result = process_message(self._envelope(txn))
        assert result["data"]["status"] == "validated"
        assert result["target_agent"] == "fraud_detector"
