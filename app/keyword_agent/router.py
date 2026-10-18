"""FastAPI router for Marketplace Keyword Agent mounted at /api/keyword-agent."""

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
import uuid
from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.auth import CurrentUser, require_user
from app.config import settings
from app.db import get_db, is_db_connected
from app.keyword_agent.events import event_manager
from app.keyword_agent.key_store import (
    delete_user_key,
    get_user_key_status,
    resolve_user_openrouter_key,
    save_user_key,
    test_openrouter_key,
)
from app.keyword_agent.openrouter_client import (
    OpenRouterAuthError,
    OpenRouterClient,
    OpenRouterCreditsError,
    OpenRouterRateLimitError,
)
from app.keyword_agent.rate_limit import (
    acquire_user_run_slot,
    release_user_run_slot,
)
from app.keyword_agent.schemas import ChatRequest, ChatResponse, ProductBrief, RunResult
from app.keyword_agent.service import WorkflowOrchestrator

logger = logging.getLogger("sheetfill.keyword_agent.router")

router = APIRouter(prefix="/api/keyword-agent", tags=["keyword-agent"])

# Active background execution tasks: run_id -> asyncio.Task
_active_run_tasks: Dict[str, asyncio.Task] = {}
_chat_histories: Dict[str, List[Dict[str, str]]] = {}


# --------------------------------------------------------------------------
# Request / Response Schemas
# --------------------------------------------------------------------------
class KeySaveRequest(BaseModel):
    api_key: str = Field(..., min_length=20, max_length=256)
    preferred_model: Optional[str] = Field(None, max_length=128)


class KeyTestRequest(BaseModel):
    api_key: Optional[str] = None


class KeyStatusResponse(BaseModel):
    configured: bool
    last4: Optional[str] = None
    preferred_model: str
    last_verified_at: Optional[str] = None


class CreateRunResponse(BaseModel):
    run_id: str
    status: str = "running"


# --------------------------------------------------------------------------
# Helper: Verify Run Ownership
# --------------------------------------------------------------------------
async def _get_user_run_doc(run_id: str, user_id: str) -> Dict[str, Any]:
    """Fetches run from MongoDB, verifying current user owns it."""
    if not is_db_connected():
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    db = get_db()
    doc = None
    for _ in range(5):
        doc = await db.keyword_agent_runs.find_one({"run_id": run_id})
        if doc:
            break
        await asyncio.sleep(0.1)

    if not doc:
        raise HTTPException(status_code=404, detail="Run not found.")

    doc_uid = str(doc.get("user_id", ""))
    if doc_uid != str(user_id):
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this run.")

    return doc


# --------------------------------------------------------------------------
# 1. BYOK Settings Routes (/settings/openrouter-key)
# --------------------------------------------------------------------------
@router.get("/settings/openrouter-key", response_model=KeyStatusResponse)
async def get_key_status(user: CurrentUser = Depends(require_user)) -> KeyStatusResponse:
    """Returns configuration status and masked last 4 of user's OpenRouter key."""
    status_dict = await get_user_key_status(user.id)
    return KeyStatusResponse(
        configured=status_dict["configured"],
        last4=status_dict["last4"],
        preferred_model=status_dict["preferred_model"],
        last_verified_at=status_dict["last_verified_at"],
    )


@router.put("/settings/openrouter-key", response_model=KeyStatusResponse)
async def update_key(
    req: KeySaveRequest,
    user: CurrentUser = Depends(require_user),
) -> KeyStatusResponse:
    """Saves or replaces user's OpenRouter API key, validating live and encrypting at rest."""
    try:
        res = await save_user_key(
            user_id=user.id,
            plain_key=req.api_key,
            preferred_model=req.preferred_model,
            verify_live=True,
        )
        return KeyStatusResponse(
            configured=res["configured"],
            last4=res["last4"],
            preferred_model=res["preferred_model"],
            last_verified_at=res["last_verified_at"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": "INVALID_KEY", "message": str(e)})
    except Exception as e:
        logger.exception(f"Failed to save OpenRouter key for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail={"code": "KEY_STORAGE_ERROR", "message": str(e)})


@router.delete("/settings/openrouter-key")
async def delete_key(user: CurrentUser = Depends(require_user)) -> Dict[str, Any]:
    """Deletes the user's stored OpenRouter key."""
    deleted = await delete_user_key(user.id)
    return {"status": "ok", "deleted": deleted}


@router.post("/settings/openrouter-key/test")
async def test_key(
    req: KeyTestRequest,
    user: CurrentUser = Depends(require_user),
) -> Dict[str, Any]:
    """Tests either a newly submitted key or the user's currently stored key."""
    api_key = req.api_key
    if not api_key:
        api_key, _ = await resolve_user_openrouter_key(user.id)
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail={"code": "NO_KEY_CONFIGURED", "message": "No OpenRouter key found to test."},
            )

    try:
        result = await test_openrouter_key(api_key)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={"code": "KEY_VERIFICATION_FAILED", "message": str(e)},
        )


@router.get("/models")
async def list_models(user: CurrentUser = Depends(require_user)) -> Dict[str, Any]:
    """Returns catalog of supported free and paid models."""
    return {
        "default": settings.keyword_agent_default_model,
        "allowed_models": settings.keyword_agent_allowed_models,
    }


# --------------------------------------------------------------------------
# 2. Run Execution & Streaming (/runs)
# --------------------------------------------------------------------------
@router.post("/runs", response_model=CreateRunResponse, status_code=201)
async def create_run(
    brief: ProductBrief,
    request: Request,
    user: CurrentUser = Depends(require_user),
) -> CreateRunResponse:
    """Initiates a Keyword Agent run using the user's personal OpenRouter key."""
    # 1. Resolve user's BYOK OpenRouter Key
    plain_key, preferred_model = await resolve_user_openrouter_key(user.id)
    if not plain_key:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "OPENROUTER_KEY_MISSING",
                "message": "An OpenRouter API key is required to run the Keyword Agent. Please add your key in Settings.",
            },
        )

    run_id = f"run_{uuid.uuid4().hex[:12]}"

    # 2. Acquire per-user rate limit slot (max 1 concurrent, 10/hour)
    await acquire_user_run_slot(user.id, run_id)

    # 3. Save initial run doc in MongoDB synchronously so SSE can connect without race conditions
    if is_db_connected():
        db = get_db()
        now = datetime.now(timezone.utc)
        u_obj_id = ObjectId(user.id) if ObjectId.is_valid(user.id) else user.id
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

    # 4. Create BYOK client and orchestrator
    llm_client = OpenRouterClient(api_key=plain_key, preferred_model=preferred_model)
    orchestrator = WorkflowOrchestrator(llm_client=llm_client)

    # 5. Define background task with slot release guarantee
    async def _execute_pipeline():
        try:
            await orchestrator.run_pipeline(
                run_id=run_id,
                user_id=user.id,
                brief=brief,
            )
        except Exception as e:
            logger.error(f"Run {run_id} failed: {e}")
        finally:
            await release_user_run_slot(user.id, run_id)
            _active_run_tasks.pop(run_id, None)

    task = asyncio.create_task(_execute_pipeline())
    _active_run_tasks[run_id] = task

    return CreateRunResponse(run_id=run_id, status="running")


@router.get("/runs/{run_id}/events")
async def stream_events(
    run_id: str,
    request: Request,
    user: CurrentUser = Depends(require_user),
    last_event_id: str | None = Header(None, alias="Last-Event-ID"),
):
    """Server-Sent Events stream for live progress and result delivery."""
    # Verify ownership
    await _get_user_run_doc(run_id, user.id)

    queue = await event_manager.get_or_create_queue(run_id)
    since_seq = -1
    if last_event_id:
        try:
            since_seq = int(last_event_id)
        except ValueError:
            pass

    history = event_manager.get_history(run_id, since_seq=since_seq)
    event_manager.increment_connections()

    async def event_generator():
        try:
            # 1. Replay historical events
            for past_event in history:
                yield {
                    "event": "message",
                    "id": str(past_event.seq),
                    "data": past_event.model_dump_json(),
                }
                if past_event.type in ("done", "error"):
                    return

            # 2. Stream live events
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield {
                        "event": "message",
                        "id": str(event.seq),
                        "data": event.model_dump_json(),
                    }
                    if event.type in ("done", "error"):
                        break
                except asyncio.TimeoutError:
                    # Keep-alive comment ping
                    yield {"comment": "ping"}
        finally:
            event_manager.decrement_connections()
            await event_manager.remove_queue(run_id, queue)

    return EventSourceResponse(event_generator())


@router.get("/runs/{run_id}")
async def get_run_details(
    run_id: str,
    user: CurrentUser = Depends(require_user),
) -> Dict[str, Any]:
    """Retrieves current status or completed result of a user's run."""
    doc = await _get_user_run_doc(run_id, user.id)
    return {
        "run_id": doc["run_id"],
        "status": doc.get("status", "pending"),
        "brief": doc.get("brief"),
        "result": doc.get("result"),
        "error_message": doc.get("error_message"),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
    }


@router.post("/runs/{run_id}/cancel")
async def cancel_run(
    run_id: str,
    user: CurrentUser = Depends(require_user),
) -> Dict[str, Any]:
    """Cancels an active run owned by the user."""
    await _get_user_run_doc(run_id, user.id)

    task = _active_run_tasks.get(run_id)
    if task and not task.done():
        task.cancel()
        _active_run_tasks.pop(run_id, None)

    await release_user_run_slot(user.id, run_id)

    if is_db_connected():
        db = get_db()
        await db.keyword_agent_runs.update_one(
            {"run_id": run_id},
            {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
        )

    await event_manager.emit(run_id, "warning", "system", "Run cancelled by user.", None)
    await event_manager.emit(run_id, "done", "system", "Execution cancelled.", None)

    return {"run_id": run_id, "cancelled": True}


@router.post("/runs/{run_id}/chat", response_model=ChatResponse)
async def chat_refine(
    run_id: str,
    req: ChatRequest,
    user: CurrentUser = Depends(require_user),
) -> ChatResponse:
    """Conversational refinement of generated titles or keywords using user's BYOK key."""
    doc = await _get_user_run_doc(run_id, user.id)
    result_data = doc.get("result")
    if not result_data:
        raise HTTPException(status_code=400, detail="Cannot refine run before results are ready.")

    plain_key, preferred_model = await resolve_user_openrouter_key(user.id)
    if not plain_key:
        raise HTTPException(status_code=402, detail="OpenRouter API key missing.")

    client = OpenRouterClient(api_key=plain_key, preferred_model=preferred_model)

    history = _chat_histories.setdefault(run_id, [])
    history.append({"role": "user", "content": req.message})

    system_prompt = (
        "You are an e-commerce fashion SEO expert. The user has generated marketplace titles and keywords "
        "and is asking for targeted adjustments. Provide concise suggestions or updated title text."
    )
    messages = [{"role": "system", "content": system_prompt}] + history[-6:]

    try:
        reply = await client.call_chat(messages=messages, role="analyst", temperature=0.3)
        history.append({"role": "assistant", "content": reply})
        return ChatResponse(reply=reply)
    except OpenRouterAuthError:
        raise HTTPException(status_code=401, detail={"code": "OPENROUTER_KEY_INVALID", "message": "OpenRouter key invalid."})
    except OpenRouterCreditsError:
        raise HTTPException(status_code=402, detail={"code": "OPENROUTER_INSUFFICIENT_CREDITS", "message": "Insufficient OpenRouter credits."})
    except OpenRouterRateLimitError:
        raise HTTPException(status_code=429, detail={"code": "OPENROUTER_RATE_LIMITED", "message": "OpenRouter rate limited."})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "CHAT_ERROR", "message": str(e)})


# --------------------------------------------------------------------------
# 3. System Preflight & Sources (/system/preflight, /sources)
# --------------------------------------------------------------------------
@router.get("/system/preflight")
async def system_preflight(user: CurrentUser = Depends(require_user)) -> Dict[str, Any]:
    """Checks backend readiness, user key configuration, and source registry."""
    key_stat = await get_user_key_status(user.id)
    return {
        "status": "ok",
        "db_connected": is_db_connected(),
        "key_configured": key_stat["configured"],
        "key_last4": key_stat["last4"],
        "preferred_model": key_stat["preferred_model"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/sources")
async def list_sources(user: CurrentUser = Depends(require_user)) -> List[Dict[str, Any]]:
    """Lists registered marketplace and social sources."""
    from app.keyword_agent.scrapers.registry import get_all_sources
    sources = get_all_sources()
    return [
        {
            "id": s.id,
            "name": s.name,
            "category": getattr(s, "category", "marketplace"),
            "enabled": True,
        }
        for s in sources.values()
    ]
