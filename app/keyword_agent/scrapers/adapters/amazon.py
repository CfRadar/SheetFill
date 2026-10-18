"""
Amazon.in B2C Marketplace Source Adapter.
Conforms to SourceAdapter Protocol.
Strategy ladder:
1. Suggest endpoint: completion.amazon.in
4. DOM selectors with fallback chains
"""

from __future__ import annotations

import logging
import re
import time
import urllib.parse
from typing import Any
from bs4 import BeautifulSoup

from app.config import get_settings
from app.keyword_agent.scrapers.base import BaseSourceAdapter, Item, SourceResult
from app.keyword_agent.scrapers.browser import BrowserManager
from app.keyword_agent.scrapers.registry import get_source_spec
from app.keyword_agent.scrapers.strategies.dom_selectors import parse_dom
from app.keyword_agent.scrapers.strategies.suggest_endpoint import execute_suggest_strategy

logger = logging.getLogger("backend.scrapers.adapters.amazon")

AUTOSUGGEST_URL = (
    "https://completion.amazon.in/api/2017/suggestions?limit=11&prefix={prefix}"
    "&suggestion-type=KEYWORD&mid=A21TJRUUN4KGV&alias=aps"
)


def parse_price(text: str | None) -> float | None:
    if not text:
        return None
    clean = re.sub(r"[^\d.]", "", text.replace(",", ""))
    try:
        return float(clean) if clean else None
    except ValueError:
        return None


def parse_rating(text: str | None) -> float | None:
    if not text:
        return None
    match = re.search(r"(\d+(\.\d+)?)", text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None


def parse_int(text: str | None) -> int | None:
    if not text:
        return None
    clean = re.sub(r"[^\d]", "", text)
    try:
        return int(clean) if clean else None
    except ValueError:
        return None


class AmazonAdapter(BaseSourceAdapter):
    def __init__(self):
        super().__init__(
            source_id="amazon",
            group="B2C",
            kind="marketplace",
            roles=["sell_target", "signal"],
        )

    def parse(self, raw: str | dict[str, Any]) -> list[Item]:
        """Pure parser function converting Amazon search result HTML into Item models."""
        if not isinstance(raw, str):
            return []

        soup = BeautifulSoup(raw, "html.parser")
        cards = soup.select('div[data-component-type="s-search-result"]')
        items: list[Item] = []

        for idx, card in enumerate(cards, 1):
            title_elem = (
                card.select_one("h2 a span") or card.select_one("h2 span") or card.select_one("h2 a")
            )
            title = title_elem.get_text(strip=True) if title_elem else ""
            if not title:
                continue

            brand_elem = (
                card.select_one("h5.s-line-clamp-1 span")
                or card.select_one("span.a-size-base-plus.a-color-base")
                or card.select_one(".s-line-clamp-1")
            )
            brand = brand_elem.get_text(strip=True) if brand_elem else None

            price_elem = card.select_one("span.a-price span.a-offscreen") or card.select_one(
                "span.a-price-whole"
            )
            price = parse_price(price_elem.get_text(strip=True) if price_elem else None)

            mrp_elem = card.select_one("span.a-price.a-text-price span.a-offscreen") or card.select_one(
                "span.a-text-strike"
            )
            mrp = parse_price(mrp_elem.get_text(strip=True) if mrp_elem else None)

            rating_elem = card.select_one("i.a-icon-star-small span.a-icon-alt") or card.select_one(
                "span.a-icon-alt"
            )
            rating = parse_rating(rating_elem.get_text(strip=True) if rating_elem else None)

            count_elem = card.select_one("span.a-size-base.s-underline-text") or card.select_one(
                'a[href*="customerReviews"] span'
            )
            rating_count = parse_int(count_elem.get_text(strip=True) if count_elem else None)

            is_sponsored = "sponsored" in card.get_text(separator=" ", strip=True).lower()

            link_elem = card.select_one("h2 a")
            href = link_elem.get("href", "") if link_elem else ""
            full_url = urllib.parse.urljoin("https://www.amazon.in", href)

            items.append(
                Item(
                    source_id="amazon",
                    title=title,
                    brand=brand,
                    price=price,
                    mrp=mrp,
                    rating=rating,
                    rating_count=rating_count,
                    position=idx,
                    sponsored=is_sponsored,
                    url=full_url,
                )
            )

        if not items:
            # Fallback to generic DOM selector parsing
            spec = get_source_spec("amazon")
            items = parse_dom(raw, spec=spec, source_id="amazon")

        return items

    def parse_related_searches(self, html: str) -> list[str]:
        soup = BeautifulSoup(html, "html.parser")
        elements = soup.select(
            'div[data-component-type="s-keyword-latent-search"] a, div.s-desktop-toolbar a[href*="field-keywords"]'
        )
        related = []
        for el in elements:
            text = el.get_text(strip=True)
            if text and text not in related:
                related.append(text)
        return related

    async def suggest(self, query: str, ctx: Any = None) -> list[str]:
        spec = get_source_spec("amazon")
        if spec:
            return await execute_suggest_strategy(spec, query)
        return []

    async def _fetch_html_http(self, url: str) -> str:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9",
        }
        try:
            from app.keyword_agent.security import SafeAsyncClient
            async with SafeAsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    return resp.text
        except Exception as err:
            logger.debug(f"Amazon HTTP fetch failed: {err}")
        return ""

    async def search(self, query: str, ctx: Any = None) -> SourceResult:
        start_time = time.time()
        spec = get_source_spec("amazon")
        settings = get_settings()
        browser_mgr = ctx if isinstance(ctx, BrowserManager) else BrowserManager.get_instance()

        suggestions = await self.suggest(query)
        encoded = urllib.parse.quote_plus(query)
        # s=review-rank sorts by customer reviews/ratings
        url = f"https://www.amazon.in/s?k={encoded}&s=review-rank"

        content = ""
        strategy_used = "dom_selectors"

        # Try browser if supported and available
        if browser_mgr.is_available():
            page = None
            try:
                context = await browser_mgr.get_context("amazon")
                page = await context.new_page()
                is_blocked, page_content = await browser_mgr.polite_goto(page, url, "amazon", spec=spec)
                if not is_blocked and page_content:
                    content = page_content
                    strategy_used = "browser"
            except Exception as e:
                logger.debug(f"Amazon browser query skipped ({e}), using HTTP fallback.")
            finally:
                if page:
                    try:
                        await page.close()
                    except Exception:
                        pass

        # Fallback to direct HTTP fetch
        if not content:
            content = await self._fetch_html_http(url)
            strategy_used = "http_html"

        duration_ms = int((time.time() - start_time) * 1000)

        if not content:
            return SourceResult(
                source_id="amazon",
                status="partial" if suggestions else "error",
                strategy_used=strategy_used,
                suggestions=suggestions,
                items=[],
                duration_ms=duration_ms,
                note="Amazon search response empty.",
            )

        items = self.parse(content)

        # Sort items rating-wise (highest rating, then highest review count)
        def item_rating_key(it: Item):
            r = it.rating if it.rating is not None else 0.0
            rc = it.rating_count if it.rating_count is not None else 0
            return (r, rc)

        items.sort(key=item_rating_key, reverse=True)
        items = items[: settings.MAX_PRODUCTS_PER_QUERY]
        for idx, it in enumerate(items, start=1):
            it.position = idx

        related = self.parse_related_searches(content)
        status = "ok" if len(items) >= 2 else ("partial" if (items or suggestions) else "error")

        return SourceResult(
            source_id="amazon",
            status=status,
            strategy_used=strategy_used if items else None,
            items=items,
            suggestions=suggestions,
            related_searches=related,
            duration_ms=duration_ms,
        )


def parse_amazon_autosuggest(data: dict) -> list[str]:
    suggestions = []
    for item in data.get("suggestions", []):
        val = item.get("value", "")
        if val and val not in suggestions:
            suggestions.append(val)
    return suggestions


# Expose pure functions for backwards compatibility
parse_search_html = AmazonAdapter().parse
parse_related_searches = AmazonAdapter().parse_related_searches
autosuggest = AmazonAdapter().suggest
