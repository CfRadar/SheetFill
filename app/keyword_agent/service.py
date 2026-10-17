"""Workflow orchestrator coordinating the 4-agent pipeline with MongoDB persistence."""

import asyncio
from datetime import datetime, timezone
import logging
import time
from typing import Any, Callable, Coroutine, Optional
from bson import ObjectId

from app.db import get_db, is_db_connected
from app.keyword_agent.agents.analyst import AnalystAgent
from app.keyword_agent.agents.marketplace_scraper import MarketplaceScraperAgent
from app.keyword_agent.agents.planner import PlannerAgent
from app.keyword_agent.agents.social_scraper import SocialScraperAgent
from app.keyword_agent.events import event_manager
from app.keyword_agent.openrouter_client import OpenRouterClient
from app.keyword_agent.schemas import (
    PlatformName,
    PlatformScrape,
    ProductBrief,
    RunResult,
    SearchPlan,
    SocialScrape,
)
from app.keyword_agent.scoring.scorer import score_all

logger = logging.getLogger("sheetfill.keyword_agent.service")


class WorkflowOrchestrator:
    """
    Coordinates the 4-agent pipeline using plain asyncio workflows:
    Planner (Agent 1) -> (Marketplace Scraper [Agent 2] || Social Scraper [Agent 3]) -> Scoring -> Analyst (Agent 4).
    Enforces per-stage timeouts, saves state in MongoDB 'keyword_agent_runs', and uses user's BYOK LLM client.
    """

    def __init__(
        self,
        llm_client: OpenRouterClient,
        planner: PlannerAgent | None = None,
        marketplace_scraper: MarketplaceScraperAgent | None = None,
        social_scraper: SocialScraperAgent | None = None,
        analyst: AnalystAgent | None = None,
    ):
        self.llm = llm_client
        self.planner = planner or PlannerAgent(llm_client=self.llm)
        self.marketplace_scraper = marketplace_scraper or MarketplaceScraperAgent()
        self.social_scraper = social_scraper or SocialScraperAgent(llm_client=self.llm)
        self.analyst = analyst or AnalystAgent(llm_client=self.llm)

    async def run_pipeline(
        self,
        run_id: str,
        user_id: str,
        brief: ProductBrief,
        emit: Callable[[str, str, str, dict | None], Coroutine[Any, Any, None]] | None = None,
        emit_node: Callable[[str, str, str | None, dict | None], Coroutine[Any, Any, None]] | None = None,
    ) -> RunResult:
        logger.info(f"Starting pipeline execution for run_id='{run_id}', user_id='{user_id}'")

        VALID_STATUSES = {"queued", "running", "success", "warning", "error", "skipped", "cached"}

        async def _bound_emit(event_type: str, stage: str, message: str, data: dict | None = None):
            await event_manager.emit(run_id, event_type, stage, message, data)

        async def _bound_emit_node(node_id: str, status: str, detail: str | None = None, metrics: dict | None = None):
            norm_status = status if status in VALID_STATUSES else ("error" if any(w in str(status).lower() for w in ("fail", "err", "fatal")) else "running")
            await event_manager.emit_node(run_id, node_id, norm_status, detail, metrics)

        # Always use the run_id-bound closures for pipeline events
        emit = _bound_emit
        emit_node = _bound_emit_node

        now = datetime.now(timezone.utc)
        u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id

        # 1. Save initial run record in MongoDB
        if is_db_connected():
            db = get_db()
            await db.keyword_agent_runs.update_one(
                {"run_id": run_id},
                {
                    "$set": {
                        "run_id": run_id,
                        "user_id": u_obj_id,
                        "brief": brief.model_dump(),
                        "status": "running",
                        "result": None,
                        "created_at": now,
                        "updated_at": now,
                    }
                },
                upsert=True,
            )

        try:
            # Stage 1: AI Planner (Timeout 120s)
            try:
                plan: SearchPlan = await asyncio.wait_for(
                    self.planner.run(brief, emit, emit_node), timeout=120.0
                )
            except TimeoutError:
                logger.warning("Planner stage timed out after 120s. Using fallback plan.")
                await emit(
                    "warning",
                    "planner",
                    "Planner LLM timed out. Using deterministic fallback plan.",
                    None,
                )
                plan = self.planner._build_deterministic_fallback(brief)
                await emit_node("planner", "warning", "Fallback plan used (timeout)")
                persona_summary = f"{plan.target_market.age_range}, {', '.join(plan.target_market.personas[:2])}"
                total_q = sum(len(q) for q in plan.marketplace_queries.values())
                await emit_node("target_market", "success", persona_summary, None)
                await emit_node("search_queries", "success", f"{total_q} queries", {"queries": total_q})

            # Stage 2: Concurrent Scraping (Timeout 300s)
            scrape_results = await asyncio.wait_for(
                asyncio.gather(
                    self.marketplace_scraper.run(plan, brief, emit, emit_node),
                    self.social_scraper.run(plan, emit, emit_node, research_sources=brief.research_sources),
                    return_exceptions=True,
                ),
                timeout=300.0,
            )

            mk_scrapes: dict[PlatformName, PlatformScrape] = {}
            if isinstance(scrape_results[0], Exception):
                logger.error(f"Marketplace scraper issue: {scrape_results[0]}")
                await emit(
                    "warning",
                    "marketplace",
                    f"Marketplace scraping issue: {scrape_results[0]}",
                    None,
                )
            else:
                mk_scrapes = scrape_results[0]

            social_scrape: SocialScrape | None = None
            if isinstance(scrape_results[1], Exception):
                logger.error(f"Social scraper issue: {scrape_results[1]}")
                await emit(
                    "warning", "social", f"Social listening issue: {scrape_results[1]}", None
                )
            else:
                social_scrape = scrape_results[1]

            # Stage 3: Deterministic Scoring (Pure Python, 0 LLM calls)
            await emit(
                "stage", "analyst", "Running deterministic multi-factor keyword scoring...", None
            )
            scored_candidates = score_all(
                brief=brief, plan=plan, marketplace_scrapes=mk_scrapes, social=social_scrape
            )

            # Stage 4: AI Analyst (Timeout 150s)
            try:
                result: RunResult = await asyncio.wait_for(
                    self.analyst.run(
                        brief=brief,
                        plan=plan,
                        scored_candidates=scored_candidates,
                        marketplace_scrapes=mk_scrapes,
                        social_scrape=social_scrape,
                        emit=emit,
                        emit_node=emit_node,
                    ),
                    timeout=150.0,
                )
            except TimeoutError:
                logger.warning("Analyst stage timed out. Using deterministic fallback.")
                await emit(
                    "warning",
                    "analyst",
                    "Analyst LLM timed out. Synthesized results using deterministic scoring engine.",
                    None,
                )
                result = self.analyst._synthesize_deterministic_fallback(
                    brief=brief,
                    scored_candidates=scored_candidates,
                    marketplace_scrapes=mk_scrapes,
                    plan=plan,
                    note="Analyst timed out. Result compiled via deterministic scoring engine.",
                )
                await emit_node("analyst", "warning", "Fallback synthesis used (timeout)")

            result.run_id = run_id

            # Save completed result in MongoDB
            if is_db_connected():
                db = get_db()
                await db.keyword_agent_runs.update_one(
                    {"run_id": run_id},
                    {
                        "$set": {
                            "status": "completed",
                            "result": result.model_dump(),
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
                # Increment usage counter
                today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                await db.keyword_agent_usage.update_one(
                    {"user_id": u_obj_id, "day": today_str},
                    {"$inc": {"call_count": self.llm.llm_calls_used}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                    upsert=True,
                )

            await emit_node("output", "success", "Keywords and titles ready", {"llm_calls": result.llm_calls_used})

            # Emit final SSE events
            await emit("result", "system", "Keywords and factors ready.", result.model_dump())
            await emit("done", "system", "Pipeline execution completed.", None)
            return result

        except Exception as err:
            logger.exception(f"Pipeline failed for run_id='{run_id}': {err}")
            if is_db_connected():
                db = get_db()
                await db.keyword_agent_runs.update_one(
                    {"run_id": run_id},
                    {
                        "$set": {
                            "status": "failed",
                            "error_message": str(err),
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
            try:
                await emit_node("output", "error", f"Run failed: {err}", None)
            except Exception as e:
                logger.warning(f"Could not emit error node: {e}")

            try:
                await emit("error", "system", f"Run failed: {err}", None)
            except Exception as e:
                logger.warning(f"Could not emit error SSE event: {e}")
            raise
