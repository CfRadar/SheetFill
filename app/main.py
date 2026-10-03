"""FastAPI main application entrypoint."""

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.sheets import router as sheets_router

app = FastAPI(
    title="Flipkart T-Shirt Listing Automation",
    description="Automates Flipkart T-shirt workbook listing generation without macro corruption.",
    version="1.0.0",
)

# Include API router
app.include_router(sheets_router)

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
                    <p>The backend is running. Frontend static build will be served here once built.</p>
                    <p><a href="/docs">View Interactive API Documentation (/docs)</a></p>
                </body>
            </html>
            """
        )
