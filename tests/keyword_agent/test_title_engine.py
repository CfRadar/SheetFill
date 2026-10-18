"""Tests for the deterministic Title Engine (rules.yaml, composer, validator, builder)."""

import pytest
from app.keyword_agent.schemas import ProductBrief, TitlePart
from app.keyword_agent.titles.builder import load_rules
from app.keyword_agent.titles.composer import compose_title, to_title_case
from app.keyword_agent.titles.validator import validate_and_compose_title


def test_rules_yaml_loaded():
    rules = load_rules()
    assert "platforms" in rules
    assert "amazon" in rules["platforms"]
    assert "flipkart" in rules["platforms"]
    assert "myntra" in rules["platforms"]
    assert "meesho" in rules["platforms"]


def test_title_casing_preserves_acronyms():
    assert to_title_case("men oversized 240gsm cotton t-shirt") == "Men Oversized 240GSM Cotton T-Shirt"
    assert to_title_case("round-neck drop-shoulder tee") == "Round-Neck Drop-Shoulder Tee"


def test_amazon_formula_composition():
    rules = load_rules()
    parts = [
        TitlePart(label="brand", text="Moonlight"),
        TitlePart(label="gender", text="Men"),
        TitlePart(label="fit", text="Oversized"),
        TitlePart(label="pattern", text="Solid"),
        TitlePart(label="color", text="Black"),
        TitlePart(label="type", text="T-Shirt"),
        TitlePart(label="fabric", text="Cotton"),
        TitlePart(label="neck", text="Round Neck"),
        TitlePart(label="sleeve", text="Half Sleeve"),
    ]
    composed, used_parts = compose_title(parts, "amazon", rules)

    assert "Moonlight" in composed
    assert composed.startswith("Moonlight")
    assert "Men" in composed
    assert "T-Shirt" in composed
    assert len(composed) <= 200


def test_unsupported_claim_dropped():
    # Brief does NOT specify 'cotton' or '240 GSM'
    brief = ProductBrief(
        tshirt_type="Graphic Tee",
        color="Black",
        gender="men",
        brand_name="StreetStyle",
    )
    # Proposed title contains unsupported '100% Cotton 240 GSM'
    proposed_parts = [
        TitlePart(label="brand", text="StreetStyle"),
        TitlePart(label="gender", text="Men"),
        TitlePart(label="fabric", text="100% Cotton 240 GSM"),
        TitlePart(label="color", text="Black"),
        TitlePart(label="type", text="Graphic Tee"),
    ]

    rules = load_rules()
    suggestion = validate_and_compose_title(
        raw_parts=proposed_parts,
        style="search",
        platform="amazon",
        brief=brief,
        platform_keywords=[],
        rules=rules,
    )

    assert "StreetStyle" in suggestion.title
    assert "Black" in suggestion.title
    assert len(suggestion.title) <= 200


def test_deterministic_pruning_on_length_overflow():
    rules = load_rules()
    brief = ProductBrief(tshirt_type="T-Shirt", color="Navy Blue", gender="men", brand_name="TestBrand")

    # Many parts exceeding Myntra's recommended range, testing pruning
    parts = [
        TitlePart(label="brand", text="TestBrand"),
        TitlePart(label="gender", text="Men"),
        TitlePart(label="fit", text="Regular Fit"),
        TitlePart(label="color", text="Navy Blue"),
        TitlePart(label="pattern", text="Solid"),
        TitlePart(label="type", text="T-Shirt"),
        TitlePart(label="fabric", text="Cotton"),
        TitlePart(label="occasion", text="Casual"),
        TitlePart(label="feature", text="Bio-Washed High Quality"),
    ]

    suggestion = validate_and_compose_title(
        raw_parts=parts,
        style="search",
        platform="myntra",
        brief=brief,
        platform_keywords=[],
        rules=rules,
    )

    hard_max = rules["platforms"]["myntra"]["hard_max"]
    assert len(suggestion.title) <= hard_max
    assert "TestBrand" in suggestion.title
