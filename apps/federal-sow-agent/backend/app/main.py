from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.config import settings
from app.observability_events import record_event
from app.database import init_db
from app.routes.generate import router as generate_router
from app.routes.merge import router as merge_router
from app.routes.sessions import router as sessions_router
from app.routes.uploads import router as uploads_router
from app.routes.workspaces import router as workspaces_router
from app.storage import ensure_storage_dirs

from app.routes.agents import router as agents_router
from app.routes.observability import router as observability_router
from app.routes.pipelines import router as pipelines_router

logger = logging.getLogger(__name__)

app = FastAPI(title="Federal Document Writer Agent API", version="0.1.0")


@app.exception_handler(HTTPException)
async def observability_http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code >= 400:
        detail = exc.detail
        if isinstance(detail, (dict, list)):
            detail_s = str(detail)[:400]
        else:
            detail_s = str(detail)[:400]
        record_event(
            "error" if exc.status_code >= 500 else "warning",
            "http",
            f"{exc.status_code} {request.method} {request.url.path}",
            detail=detail_s,
        )
    return await http_exception_handler(request, exc)


allowed_origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def security_headers(request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self' https://unpkg.com; img-src 'self' https://unpkg.com data:; "
        "style-src 'self' https://unpkg.com 'unsafe-inline'; script-src 'self'; "
        "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000;"
    )
    return response


@app.on_event("startup")
def startup() -> None:
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    ensure_storage_dirs()
    init_db()
    # Pipeline config is code-only (not migrated from SQLite); unknown phase ids silently use sow_writer.
    from app.agents_config import pipeline_sequence_warnings

    for warn in pipeline_sequence_warnings():
        logger.warning("%s", warn)

    record_event("info", "server", "API process started")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    return {"status": "ready"}


app.include_router(agents_router)
app.include_router(observability_router)
app.include_router(pipelines_router)
app.include_router(workspaces_router)
app.include_router(sessions_router)
app.include_router(uploads_router)
app.include_router(generate_router)
app.include_router(merge_router)
