"""Public observability status (no secrets). LangSmith UI is linked from the frontend."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.observability_events import get_recent_events

router = APIRouter(prefix="/observability", tags=["observability"])


@router.get("")
def observability_status():
    """Whether LangSmith tracing is configured server-side; safe for the UI."""
    key = (settings.langchain_api_key or "").strip()
    tracing = bool(settings.langchain_tracing_v2 and key)
    return {
        "langsmith_tracing_enabled": tracing,
        "langchain_project": settings.langchain_project if tracing else None,
        "langsmith_ui_base": "https://smith.langchain.com",
        "recent_events": get_recent_events(50),
        "events_note": (
            "Recent pipeline, merge, and HTTP events (last 50). Stored in memory only and cleared when the "
            "API process restarts. Use LangSmith for full LLM traces."
        ),
    }
