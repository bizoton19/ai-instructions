"""Convert non-DOCX templates into markdown masters and merge agent content into them."""

from __future__ import annotations

import json
import re
from typing import Any

_SOW_KEYWORDS: dict[str, tuple[str, ...]] = {
    "purpose": ("purpose", "objective", "objective(s)"),
    "background": ("background", "overview", "context"),
    "scope": ("scope", "work scope"),
    "deliverables": ("deliverable", "deliverables", "outputs"),
    "period_of_performance": ("period", "performance period", "timeline", "schedule"),
    "roles_and_responsibilities": ("roles", "responsibilities", "government-furnished", "contractor"),
    "acceptance_criteria": ("acceptance", "quality", "standards"),
    "assumptions_and_constraints": ("assumption", "constraint", "limitation"),
}

_SOW_ORDER = (
    "purpose",
    "background",
    "scope",
    "deliverables",
    "period_of_performance",
    "roles_and_responsibilities",
    "acceptance_criteria",
    "assumptions_and_constraints",
)


def _normalize_heading(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def _infer_sow_key_from_heading(heading: str) -> str | None:
    h = _normalize_heading(heading)
    if not h:
        return None
    for key, words in _SOW_KEYWORDS.items():
        if any(w in h for w in words):
            return key
    return None


def build_master_template_markdown_from_outline(
    *,
    filename: str,
    outline_obj: dict[str, Any] | None,
) -> str:
    """Create a deterministic markdown template skeleton from stored outline metadata."""
    obj = outline_obj or {}
    kind = str(obj.get("kind") or "unknown").lower()
    headings = [str(h).strip() for h in (obj.get("headings") or []) if str(h).strip()]
    excerpt = str(obj.get("text_excerpt") or "").strip()

    lines: list[str] = [
        f"# Template Master: {filename}",
        "",
        f"_Source type: {kind}_",
        "",
        "<!-- Generated template skeleton used to place agent-authored content into non-DOCX template structure. -->",
        "",
    ]

    if headings:
        for heading in headings[:40]:
            lines.append(f"## {heading}")
            lines.append("")
            inferred = _infer_sow_key_from_heading(heading)
            if inferred:
                lines.append(f"{{{{slot:{inferred}}}}}")
            else:
                lines.append("{{slot:full_markdown}}")
            lines.append("")
    else:
        lines.append("## Generated Content")
        lines.append("")
        lines.append("{{slot:full_markdown}}")
        lines.append("")

    if excerpt:
        lines.append("---")
        lines.append("")
        lines.append("### Reference Excerpt")
        lines.append("")
        lines.append((excerpt[:6000]).strip())
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def parse_outline_json(outline_json: str | None) -> dict[str, Any]:
    if not outline_json:
        return {}
    try:
        obj = json.loads(outline_json)
    except Exception:
        return {}
    return obj if isinstance(obj, dict) else {}


def _flat_context_to_markdown_body(flat_context: dict[str, str]) -> str:
    body = (flat_context.get("full_markdown") or "").strip()
    if body:
        return body
    parts: list[str] = []
    for key in _SOW_ORDER:
        block = (flat_context.get(key) or "").strip()
        if not block:
            continue
        title = key.replace("_", " ").title()
        parts.append(f"## {title}\n\n{block}")
    return ("\n\n".join(parts)).strip() or "[No generated narrative text was available.]"


def merge_flat_context_into_master_markdown(master_md: str, flat_context: dict[str, str]) -> str:
    """Merge agent-authored content into a markdown master template using slot markers."""
    body = _flat_context_to_markdown_body(flat_context)
    merged = master_md or "## Generated Content\n\n{{slot:full_markdown}}\n"

    used_full = False
    for key in _SOW_ORDER:
        token = f"{{{{slot:{key}}}}}"
        val = (flat_context.get(key) or "").strip()
        if token in merged:
            merged = merged.replace(token, val if val else "")

    full_token = "{{slot:full_markdown}}"
    while full_token in merged:
        merged = merged.replace(full_token, body if not used_full else "")
        used_full = True

    return merged.strip() + "\n"
