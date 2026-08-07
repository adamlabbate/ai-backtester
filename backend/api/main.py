from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.backtest import router as backtest_router

# FastAPI() is the application object -- everything (routes, middleware)
# attaches to this one instance, and it's what an ASGI server like uvicorn
# actually runs.
app = FastAPI(title="AI Backtester API")

# Browsers block JS running on one origin (e.g. http://localhost:5173, where
# the React dev server will live) from calling an API on a different origin
# (http://localhost:8000, this server) unless the API explicitly opts in via
# these CORS headers. Without this, the frontend's fetch() calls would fail
# silently with a CORS error in the browser console.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every route defined in routes/backtest.py becomes available under /api,
# so POST /backtest there is really POST /api/backtest.
app.include_router(backtest_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
