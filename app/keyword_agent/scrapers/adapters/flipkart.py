"""
Flipkart B2C Marketplace Source Adapter.
Conforms to SourceAdapter Protocol.
Strategy ladder:
4. DOM structural anchors (/p/, pid=, div[data-id])
5. Heuristics fallback
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
from app.keyword_agent.scrapers.strategies.heuristics import parse_heuristics

logger = logging.getLogger("backend.scrapers.adapters.flipkart")


def parse_price_regex(text: str) -> float | None:
    match = re.search(r"₹\s*([\d,]+)", text)
    if match:
        digits = match.group(1).replace(",", "")
        try:
            return float(digits)
        except ValueError:
            return None
    return None


def parse_rating_regex(text: str) -> float | None:
    match = re.search(r"\b([1-5]\.\d)\b", text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None


class FlipkartAdapter(BaseSourceAdapter):
    def __init__(self):
        super().__init__(
            source_id="flipkart",
            group="B2C",
            kind="marketplace",
            roles=["sell_target", "signal"],
        )

    def parse(self, raw: str | dict[str, Any]) -> list[Item]:
        """
        Pure parser function. Structural parser for Flipkart's obfuscated CSS classes.
        Finds product cards with data-id or anchors targeting product links (/p/ or pid=).
        """
        if not isinstance(raw, str):
            return []

        soup = BeautifulSoup(raw, "html.parser")
        cards = soup.select("div[data-id]")
        if not cards:
            cards = [
                a.parent
                for a in soup.select('a[href*="/p/"]')
                if a.parent and len(a.parent.get_text()) > 30
            ]

        items: list[Item] = []

        for idx, card in enumerate(cards, 1):
            link = card.select_one('a[href*="/p/"]') or card.select_one('a[href*="pid="]')
            href = link.get("href", "") if link else ""
            if not href:
                continue
            full_url = urllib.parse.urljoin("https://www.flipkart.com", href)

            # Title
            title_elem = (
                card.select_one("a.WKTcLC")
                or card.select_one("a.IRpwTa")
                or card.select_one("div.KzDlHZ")
                or card.select_one("div._4rR01T")
                or link
            )
            title = title_elem.get_text(strip=True) if title_elem else ""

            # Brand
            brand_elem = card.select_one("div._2WkVRV") or card.select_one("div._2W9cHo") or card.select_one("div.syl9yP")
            brand = brand_elem.get_text(strip=True) if brand_elem else None

            # Price
            price_elem = card.select_one("div.Nx9bqj") or card.select_one("div._30jeq3")
            price = None
            if price_elem:
                price = parse_price_regex(price_elem.get_text())

            # MRP
            mrp_elem = card.select_one("div.yRaY8j") or card.select_one("div._3I9_wc")
            mrp = None
            if mrp_elem:
                mrp = parse_price_regex(mrp_elem.get_text())

            # Rating
            rating_elem = (
                card.select_one("div.XQDdHH")
                or card.select_one("div._3LWZlK")
                or card.select_one("div._5OesEi")
                or card.select_one("div[class*='XQDdHH']")
                or card.select_one("div[class*='_3LWZlK']")
                or card.select_one("span[id*='productRating']")
            )
            rating = None
            if rating_elem:
                rating = parse_rating_regex(rating_elem.get_text())
            elif card:
                # Regex fallback on card text for star rating (e.g. 4.2★)
                m_star = re.search(r"\b([3-5]\.\d)\s*(?:★|\*|\b)", card.get_text())
                if m_star:
                    try:
                        rating = float(m_star.group(1))
                    except ValueError:
                        pass

            rating_count_elem = (
                card.select_one("span.Wphh3N")
                or card.select_one("span._2_R_DZ")
                or card.select_one("span._13vcmD")
                or card.select_one("span[class*='Wphh3N']")
                or card.select_one("span[class*='_2_R_DZ']")
            )
            rating_count = None
            if rating_count_elem:
                raw_rc = rating_count_elem.get_text(strip=True).lower()
                if "k" in raw_rc:
                    try:
                        rating_count = int(float(re.findall(r"\d+\.?\d*", raw_rc)[0]) * 1000)
                    except Exception:
                        pass
                else:
                    digits = re.sub(r"[^\d]", "", raw_rc)
                    if digits:
                        try:
                            rating_count = int(digits)
                        except ValueError:
                            pass
            elif card:
                # Regex fallback for review count in parentheses (e.g. (1,820))
                m_rc = re.search(r"\(([\d,]+(?:\.\d+)?k?)\)", card.get_text())
                if m_rc:
                    rc_str = m_rc.group(1).lower()
                    if "k" in rc_str:
                        try:
                            rating_count = int(float(re.findall(r"\d+\.?\d*", rc_str)[0]) * 1000)
                        except Exception:
                            pass
                    else:
                        digits = re.sub(r"[^\d]", "", rc_str)
                        if digits:
                            try:
                                rating_count = int(digits)
                            except ValueError:
                                pass

            if not title or len(title) < 3:
                continue

            items.append(
                Item(
                    source_id="flipkart",
                    title=f"{brand + ' ' if brand and brand not in title else ''}{title}".strip(),
                    brand=brand,
                    price=price,
                    mrp=mrp,
                    rating=rating,
                    rating_count=rating_count,
                    position=idx,
                    url=full_url,
                )
            )

        if not items:
            spec = get_source_spec("flipkart")
            items = parse_dom(raw, spec=spec, source_id="flipkart")

        if not items:
            items = parse_heuristics(raw, "flipkart")

        return items

    async def suggest(self, query: str, ctx: Any = None) -> list[str]:
        encoded = urllib.parse.quote_plus(query)
        url = f"https://www.flipkart.com/api/6/search/autosuggest?q={encoded}"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
        }
        try:
            from app.keyword_agent.security import SafeAsyncClient
            async with SafeAsyncClient(timeout=6.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    suggs: list[str] = []
                    if isinstance(data, dict):
                        resp_obj = data.get("RESPONSE", {})
                        sq = resp_obj.get("suggestedQueries", [])
                        for item in sq:
                            q_text = item.get("query") if isinstance(item, dict) else str(item)
                            if q_text and q_text not in suggs:
                                suggs.append(q_text.strip())
                    return suggs[:10]
        except Exception as e:
            logger.debug(f"Flipkart autosuggest failed: {e}")
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
            logger.debug(f"Flipkart HTTP fetch failed: {err}")
        return ""

    async def search(self, query: str, ctx: Any = None) -> SourceResult:
        start_time = time.time()
        spec = get_source_spec("flipkart")
        settings = get_settings()
        browser_mgr = ctx if isinstance(ctx, BrowserManager) else BrowserManager.get_instance()

        suggestions = await self.suggest(query)
        encoded = urllib.parse.quote_plus(query)
        url = f"https://www.flipkart.com/search?q={encoded}&sort=popularity"

        content = ""
        strategy_used = "dom_selectors"

        if browser_mgr.is_available():
            page = None
            try:
                context = await browser_mgr.get_context("flipkart")
                page = await context.new_page()
                is_blocked, page_content = await browser_mgr.polite_goto(page, url, "flipkart", spec=spec)
                if not is_blocked and page_content:
                    content = page_content
                    strategy_used = "browser"
            except Exception as e:
                logger.debug(f"Flipkart browser query skipped ({e}), using HTTP fallback.")
            finally:
                if page:
                    try:
                        await page.close()
                    except Exception:
                        pass

        # Direct HTTP fallback
        if not content:
            content = await self._fetch_html_http(url)
            strategy_used = "http_html"

        duration_ms = int((time.time() - start_time) * 1000)

        if not content:
            return SourceResult(
                source_id="flipkart",
                status="partial" if suggestions else "error",
                strategy_used=strategy_used,
                suggestions=suggestions,
                items=[],
                duration_ms=duration_ms,
                note="Flipkart search response empty.",
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

        status = "ok" if len(items) >= 2 else ("partial" if (items or suggestions) else "error")

        return SourceResult(
            source_id="flipkart",
            status=status,
            strategy_used=strategy_used if items else None,
            items=items,
            suggestions=suggestions,
            duration_ms=duration_ms,
        )


parse_search_html = FlipkartAdapter().parse
