"""
Myntra B2C Marketplace Source Adapter.
Conforms to SourceAdapter Protocol.
Strategy ladder:
2. Embedded JSON state: window.__myntraState
4. DOM selectors: li.product-base
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
from app.keyword_agent.scrapers.strategies.embedded_json import extract_embedded_json

logger = logging.getLogger("backend.scrapers.adapters.myntra")


class MyntraAdapter(BaseSourceAdapter):
    def __init__(self):
        super().__init__(
            source_id="myntra",
            group="B2C",
            kind="marketplace",
            roles=["sell_target", "signal"],
        )

    def parse(self, raw: str | dict[str, Any]) -> list[Item]:
        """
        Pure parser function. First attempts to extract structured embedded state
        window.__myntraState; falls back to DOM parsing.
        """
        if not isinstance(raw, str):
            return []

        # 1. Strategy 2: Embedded JSON state
        embedded_items = extract_embedded_json("myntra", raw)
        if embedded_items:
            return embedded_items

        # 2. Strategy 4: DOM parsing fallback
        soup = BeautifulSoup(raw, "html.parser")
        cards = soup.select("li.product-base, div.product-card")
        items: list[Item] = []

        for idx, card in enumerate(cards, 1):
            brand_elem = card.select_one("h3.product-brand")
            name_elem = card.select_one("h4.product-product") or card.select_one("h3.product-brand + h4")
            brand = brand_elem.get_text(strip=True) if brand_elem else None
            name = name_elem.get_text(strip=True) if name_elem else ""
            title = f"{brand or ''} {name}".strip()
            if not title:
                continue

            price_elem = card.select_one("div.product-price span.product-discountedPrice") or card.select_one("div.product-price span")
            price_val = None
            if price_elem:
                raw_p = "".join(filter(lambda c: c.isdigit() or c == ".", price_elem.get_text()))
                try:
                    price_val = float(raw_p) if raw_p else None
                except ValueError:
                    pass

            mrp_elem = card.select_one("div.product-price span.product-strike")
            mrp_val = None
            if mrp_elem:
                raw_mrp = "".join(filter(lambda c: c.isdigit() or c == ".", mrp_elem.get_text()))
                try:
                    mrp_val = float(raw_mrp) if raw_mrp else None
                except ValueError:
                    pass

            rating_elem = card.select_one("div.product-ratingsContainer span, div[class*='ratingsContainer'] span, div[class*='Rating']")
            rating_val = None
            if rating_elem:
                try:
                    rating_val = float(re.findall(r"\d+\.?\d*", rating_elem.get_text(strip=True))[0])
                except (ValueError, IndexError):
                    pass
            elif card:
                m_rt = re.search(r"\b([3-5]\.\d)\s*(?:★|\|)?", card.get_text())
                if m_rt:
                    try:
                        rating_val = float(m_rt.group(1))
                    except ValueError:
                        pass

            rating_count_elem = card.select_one("div.product-ratingsCount, div.product-ratingsContainer div, span[class*='ratingsCount'], div[class*='ratingsCount']")
            rating_count_val = None
            if rating_count_elem:
                raw_rc = rating_count_elem.get_text(strip=True).replace("|", "").strip().lower()
                if "k" in raw_rc:
                    try:
                        rating_count_val = int(float(re.findall(r"\d+\.?\d*", raw_rc)[0]) * 1000)
                    except Exception:
                        pass
                else:
                    digits = re.sub(r"[^\d]", "", raw_rc)
                    if digits:
                        try:
                            rating_count_val = int(digits)
                        except ValueError:
                            pass

            link_elem = card.select_one("a[href]")
            href = link_elem.get("href", "") if link_elem else ""
            full_url = urllib.parse.urljoin("https://www.myntra.com/", href)

            items.append(
                Item(
                    source_id="myntra",
                    title=title,
                    brand=brand,
                    price=price_val,
                    mrp=mrp_val,
                    rating=rating_val,
                    rating_count=rating_count_val,
                    position=idx,
                    url=full_url,
                )
            )

        if not items:
            spec = get_source_spec("myntra")
            items = parse_dom(raw, spec=spec, source_id="myntra")

        return items

    async def suggest(self, query: str, ctx: Any = None) -> list[str]:
        # Suggest endpoint returns 401 without specific app headers; return empty list gracefully
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
            logger.debug(f"Myntra HTTP fetch failed: {err}")
        return ""

    async def search(self, query: str, ctx: Any = None) -> SourceResult:
        start_time = time.time()
        spec = get_source_spec("myntra")
        settings = get_settings()
        browser_mgr = ctx if isinstance(ctx, BrowserManager) else BrowserManager.get_instance()

        clean_q = re.sub(r"[^\w\s-]", "", query).strip().replace(" ", "-")
        url = f"https://www.myntra.com/{clean_q}?sort=customer_rating"

        content = ""
        strategy = "dom_selectors"

        if browser_mgr.is_available():
            page = None
            try:
                context = await browser_mgr.get_context("myntra")
                page = await context.new_page()
                is_blocked, page_content = await browser_mgr.polite_goto(page, url, "myntra", spec=spec)
                if not is_blocked and page_content:
                    content = page_content
                    strategy = "browser"
            except Exception as e:
                logger.debug(f"Myntra browser query skipped ({e}), using HTTP fallback.")
            finally:
                if page:
                    try:
                        await page.close()
                    except Exception:
                        pass

        if not content:
            content = await self._fetch_html_http(url)
            strategy = "http_html"

        duration_ms = int((time.time() - start_time) * 1000)

        if not content:
            return SourceResult(
                source_id="myntra",
                status="error",
                strategy_used="none",
                items=[],
                duration_ms=duration_ms,
                note="Myntra search response empty.",
            )

        # Check if embedded JSON yielded items
        items = extract_embedded_json("myntra", content)
        if not items:
            items = self.parse(content)
        else:
            strategy = "embedded_json"

        # Sort items rating-wise (highest rating, then highest review count)
        def item_rating_key(it: Item):
            r = it.rating if it.rating is not None else 0.0
            rc = it.rating_count if it.rating_count is not None else 0
            return (r, rc)

        items.sort(key=item_rating_key, reverse=True)
        items = items[: settings.MAX_PRODUCTS_PER_QUERY]
        for idx, it in enumerate(items, start=1):
            it.position = idx

        status = "ok" if len(items) >= 2 else ("partial" if items else "error")

        return SourceResult(
            source_id="myntra",
            status=status,
            strategy_used=strategy if items else None,
            items=items,
            duration_ms=duration_ms,
        )


parse_search_html = MyntraAdapter().parse
