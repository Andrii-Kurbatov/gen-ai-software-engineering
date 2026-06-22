"""Tests for agents/common.py utilities."""

import uuid
from datetime import datetime, timezone

import pytest

from agents.common import make_envelope, mask_account, now_iso


class TestNowIso:
    def test_format(self):
        ts = now_iso()
        # Must parse without error and be UTC
        dt = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")
        assert dt is not None

    def test_is_recent(self):
        before = datetime.now(timezone.utc).replace(microsecond=0)
        ts = now_iso()
        after = datetime.now(timezone.utc).replace(microsecond=0)
        dt = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        assert before <= dt <= after


class TestMaskAccount:
    def test_masks_acc_prefix(self):
        assert mask_account("ACC-1234") == "ACC-***"

    def test_masks_any_acc_suffix(self):
        assert mask_account("ACC-ABCD") == "ACC-***"

    def test_non_acc_string_returns_stars(self):
        assert mask_account("REGULAR") == "***"

    def test_empty_string_returns_stars(self):
        assert mask_account("") == "***"


class TestMakeEnvelope:
    def test_required_keys_present(self):
        env = make_envelope("src", "tgt", {"k": "v"})
        assert set(env.keys()) == {
            "message_id", "timestamp", "source_agent",
            "target_agent", "message_type", "data",
        }

    def test_agents_set(self):
        env = make_envelope("a", "b", {})
        assert env["source_agent"] == "a"
        assert env["target_agent"] == "b"

    def test_data_passed_through(self):
        data = {"transaction_id": "TXN001"}
        env = make_envelope("a", "b", data)
        assert env["data"] == data

    def test_message_id_is_uuid4(self):
        env = make_envelope("a", "b", {})
        parsed = uuid.UUID(env["message_id"])
        assert parsed.version == 4

    def test_default_message_type(self):
        env = make_envelope("a", "b", {})
        assert env["message_type"] == "transaction"

    def test_custom_message_type(self):
        env = make_envelope("a", "b", {}, message_type="custom")
        assert env["message_type"] == "custom"
