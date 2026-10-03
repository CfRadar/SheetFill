"""Tests for bulk_matcher service covering Section 7 requirements."""

import json
from pathlib import Path
import pytest

from app.services.bulk_matcher import match_bulk_json
from app.services.design_detector import detect_designs
from app.services.sheet_reader import read_tshirt_sheet

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def before_designs():
    sheet = read_tshirt_sheet(str(FIXTURES_DIR / "1_before.xls"))
    res = detect_designs(sheet)
    return res.designs


@pytest.fixture
def batch_json_text():
    path = FIXTURES_DIR / "batch_1_to_2.json"
    return path.read_text(encoding="utf-8")


def test_bulk_match_exact(before_designs, batch_json_text):
    res = match_bulk_json(batch_json_text, before_designs)
    assert len(res.assigned) == 8
    assert len(res.unmatched_json) == 0
    assert len(res.unmatched_designs) == 0
    for a in res.assigned:
        assert a.how == "exact"
        assert not a.requires_confirmation


def test_bulk_match_shuffled(before_designs, batch_json_text):
    items = json.loads(batch_json_text)
    shuffled_text = json.dumps(list(reversed(items)))
    res = match_bulk_json(shuffled_text, before_designs)
    assert len(res.assigned) == 8
    assert len(res.unmatched_json) == 0
    assert len(res.unmatched_designs) == 0


def test_bulk_match_one_removed(before_designs, batch_json_text):
    items = json.loads(batch_json_text)
    reduced_text = json.dumps(items[:7])
    res = match_bulk_json(reduced_text, before_designs)
    assert len(res.assigned) == 7
    assert len(res.unmatched_designs) == 1
    assert len(res.unmatched_json) == 0


def test_bulk_match_unknown_sku_base(before_designs, batch_json_text):
    items = json.loads(batch_json_text)
    unknown_item = dict(items[0], sku_base="totally_unknown_sku_123")
    res = match_bulk_json(json.dumps([unknown_item]), before_designs)
    assert len(res.assigned) == 0
    assert len(res.unmatched_json) == 1
