"""FastAPI main application entrypoint with lifespan, CORS, security headers, and health probe."""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from pathlib import Path
from typing import Any, AsyncGenerator, Dict
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import asyncio
import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

# Ensure local 'src' directory containing flipkart_filler is on python path
_src_dir = str(Path(__file__).resolve().parent.parent / "src")
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from app.admin import router as admin_router
from app.api.sheets import router as sheets_router
from app.auth import router as auth_router
from app.keyword_agent.router import router as keyword_agent_router
from app.keyword_agent.security import SecretRedactingFilter
from app.config import settings
from app.db import close_db, connect_and_init_db, is_db_connected

logger = logging.getLogger("sheetfill.main")
# Apply secret redaction filter across root logger
logging.getLogger().addFilter(SecretRedactingFilter())


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manages application startup and shutdown lifecycle."""
    # Validate production configuration if configured
    settings.validate_production()

    # Attempt to connect to MongoDB and build indexes
    await connect_and_init_db(max_retries=5, initial_delay=1.0)
    yield
    await close_db()


# Configure docs visibility based on environment
docs_url = None if settings.env == "production" else "/docs"
redoc_url = None if settings.env == "production" else "/redoc"
openapi_url = None if settings.env == "production" else "/openapi.json"

app = FastAPI(
    title="Flipkart T-Shirt Listing Automation",
    description="Automates Flipkart T-shirt workbook listing generation with subscription access control.",
    version="1.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
    lifespan=lifespan,
)

# CORS middleware
raw_origins = [o.strip().rstrip("/") for o in settings.frontend_origin.split(",") if o.strip()]
default_origins = [
    "https://sheet-fill-snowy.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
]
origins = list(dict.fromkeys(raw_origins + default_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    # Enforce no-cache on sensitive API endpoints
    path = request.url.path
    if path.startswith("/api/auth") or path.startswith("/api/admin") or "/download" in path:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"

    return response


# Global exception handler for uniform error JSON formatting
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled server error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred. Please try again later.",
                "details": None,
            }
        },
    )


# --------------------------------------------------------------------------
# Public Health Probe: /api/health
# --------------------------------------------------------------------------
@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    """Public probe reporting container and database status for Render wake-up."""
    return {
        "status": "ok",
        "db": is_db_connected(),
        "ts": datetime.now(timezone.utc).isoformat(),
        "env": settings.env,
    }


# --------------------------------------------------------------------------
# Public Version Endpoint: /api/version
# --------------------------------------------------------------------------
@app.get("/api/version")
async def get_version() -> Dict[str, Any]:
    """Public version endpoint returning build metadata and active feature set."""
    return {
        "status": "ok",
        "version": "1.2.0",
        "commit": "style-code-and-anti-cache-v1.2",
        "features": [
            "style_code_autofill_from_sku",
            "per_product_group_indexing",
            "global_brand_packer_manufacturer",
            "strict_download_cache_invalidation",
            "session_output_auto_reset",
        ],
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


# Include Routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(sheets_router)
app.include_router(keyword_agent_router)

# Mount frontend build if it exists
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
else:
    @app.get("/")
    def index_fallback() -> HTMLResponse:
        return HTMLResponse(
            """
            <html>
                <head><title>Flipkart T-Shirt Filler</title></head>
                <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                    <h2>Flipkart T-Shirt Listing Automation API</h2>
                    <p>The backend is running with subscription access control.</p>
                </body>
            </html>
            """
        )
