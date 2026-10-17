"""Tests for deterministic 5-factor mathematical keyword scoring (0 LLM)."""

import pytest
from app.keyword_agent.schemas import PlatformScrape, ProductBrief, ScrapedProduct, SearchPlan, TargetMarket
from app.keyword_agent.scoring.scorer import score_all, score_platform


def test_scoring_weights_and_normalization():
    brief = ProductBrief(
        tshirt_type="Oversized T-Shirt",
        color="Black",
        gender="men",
        brand_name="Moonlight",
    )
    plan = SearchPlan(
        target_market=TargetMarket(
            age_range="18-25",
            personas=["gen-z", "college"],
            interests=["streetwear", "graphic tees"],
            regions=["metro"],
            language_notes="English, Hinglish",
        ),
        marketplace_queries={"flipkart": ["black oversized t shirt men"]},
        social_queries=["oversized streetwear"],
        seed_keywords=["black oversized", "cotton graphic tee"],
    )
    products = [
        ScrapedProduct(platform="flipkart", position=1, title="Moonlight Men Black Oversized T-Shirt", rating_count=1200, url="https://flipkart.com/1"),
        ScrapedProduct(platform="flipkart", position=2, title="Men Black Printed Oversized Cotton Tee", rating_count=450, url="https://flipkart.com/2"),
        ScrapedProduct(platform="flipkart", position=3, title="Casual Black Loose Fit T-Shirt", rating_count=80, url="https://flipkart.com/3"),
    ]
    scrape = PlatformScrape(
        platform="flipkart",
        status="ok",
        products=products,
        suggestions=["black oversized t shirt men", "black oversized t shirt combo"],
    )

    scored = score_platform(
        platform="flipkart",
        scrape=scrape,
        social=None,
        brief=brief,
    )

    assert len(scored) > 0
    top_cand, top_score = scored[0]
    assert isinstance(top_cand, str)
    assert 0.0 <= top_score <= 1.0


def test_score_all_platforms():
    brief = ProductBrief(tshirt_type="Polo T-Shirt", color="White", gender="men")
    plan = SearchPlan(
        target_market=TargetMarket(
            age_range="25-40",
            personas=["office", "casual"],
            interests=["smart casual"],
            regions=["all-india"],
            language_notes="English",
        ),
        marketplace_queries={
            "amazon": ["white polo t shirt men"],
            "flipkart": ["men white polo tshirt"],
        },
        social_queries=["polo styling tips"],
        seed_keywords=["white polo", "classic polo"],
    )
    scrapes = {
        "amazon": PlatformScrape(
            platform="amazon",
            status="ok",
            products=[ScrapedProduct(platform="amazon", position=1, title="Classic White Polo T-Shirt", rating_count=300, url="https://amazon.in/1")],
            suggestions=["white polo t shirt men"],
        ),
        "flipkart": PlatformScrape(
            platform="flipkart",
            status="ok",
            products=[ScrapedProduct(platform="flipkart", position=1, title="Solid White Polo Neck T-Shirt", rating_count=150, url="https://flipkart.com/1")],
            suggestions=["men white polo tshirt"],
        ),
    }

    results = score_all(brief=brief, plan=plan, marketplace_scrapes=scrapes, social=None)
    assert "amazon" in results
    assert "flipkart" in results
    assert len(results["amazon"]) > 0
    assert len(results["flipkart"]) > 0
