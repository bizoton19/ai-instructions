"""Small in-process event log for the Operations / observability UI (no secrets, truncated fields).

Events are stored in a fixed-size deque and are cleared on process restart. For production
central logging, forward the same signals to your SIEM or log aggregator separately.
"""

from __future__ import annotations

import threading
from collections import deque
from datetime import datetime, timezone
from typing import Any

_MAX = 150
_lock = threading.Lock()
_buffer: deque[dict[str, Any]] = deque(maxlen=_MAX)


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def record_event(
    level: str,
    category: str,
    message: str,
    *,
    detail: str | None = None,
    **context: Any,
) -> None:
    """Append one event. ``level`` is info | warning | error. ``context`` must be JSON-serializable."""
    safe_detail = (detail or "")[:500] if detail else None
    ctx: dict[str, Any] = {}
    for k, v in context.items():
        if v is None:
            continue
        if isinstance(v, (str, int, float, bool)):
            ctx[k] = str(v)[:200] if isinstance(v, str) else v
        else:
            ctx[k] = str(v)[:200]

    entry = {
        "ts": _utc_iso(),
        "level": level,
        "category": category,
        "message": (message or "")[:400],
        "detail": safe_detail,
        "context": ctx,
    }
    with _lock:
        _buffer.append(entry)


def get_recent_events(limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        items = list(_buffer)
    if limit <= 0:
        return []
    return items[-limit:]
