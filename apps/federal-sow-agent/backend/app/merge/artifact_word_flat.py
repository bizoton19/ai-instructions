"""Phase-aware flattening for Word export from ``PipelineArtifact`` rows."""

from __future__ import annotations

import json
from typing import Any

from app.merge.docx_merge import sow_model_to_flat
from app.models import PipelineArtifact
from app.schemas import SOWSectionsModel


def _structured_dict(artifact: PipelineArtifact) -> dict[str, Any]:
    try:
        raw = json.loads(artifact.structured_data_json or "{}")
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _markdown_from_non_sow_structured(data: dict[str, Any]) -> str:
    """Prefer full_markdown key; otherwise render key/value + JSON for nested structures."""

    fm = (data.get("full_markdown") or "").strip()
    if fm:
        return fm
    lines: list[str] = []
    for key in sorted(data.keys()):
        val = data[key]
        if key == "full_markdown":
            continue
        label = key.replace("_", " ").title()
        if isinstance(val, str):
            if val.strip():
                lines.append(f"## {label}\n\n{val.strip()}\n")
        elif isinstance(val, (list, dict)) and val:
            try:
                pretty = json.dumps(val, indent=2, default=str)[:28000]
            except Exception:
                pretty = str(val)[:8000]
            lines.append(f"## {label}\n\n```json\n{pretty}\n```\n")
        elif val not in (None, "", [], {}):
            lines.append(f"## {label}\n\n{val}\n")
    body = "\n".join(lines).strip()
    return body if body else "[No markdown or structured narrative was produced for this phase.]"


def flat_context_from_pipeline_artifact(artifact: PipelineArtifact) -> dict[str, str]:
    """
    Build ``flat_context`` for ``standalone_docx_from_flat`` / ``merge_docx``.

    SOW Writer: validate into ``SOWSectionsModel`` when possible so titled sections export.
    Other specialists: put primary narrative in ``full_markdown`` (from stored markdown or synthesized).
    """

    raw = _structured_dict(artifact)
    stored_fm = (artifact.full_markdown or "").strip()
    fm = stored_fm or (raw.get("full_markdown") or "").strip()

    agent_id = (artifact.agent_id or "").strip()

    if agent_id == "sow_writer":
        try:
            merged = dict(raw)
            if stored_fm:
                merged["full_markdown"] = stored_fm
            model = SOWSectionsModel.model_validate(merged)
            return sow_model_to_flat(model)
        except Exception:
            return sow_model_to_flat(SOWSectionsModel(full_markdown=fm or "[SOW artifact could not be parsed for export.]"))

    body = fm if fm else _markdown_from_non_sow_structured(raw)
    return sow_model_to_flat(SOWSectionsModel(full_markdown=body))
