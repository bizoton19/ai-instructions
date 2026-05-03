"""Build ZIP byte payloads for pipeline session artifact handoff."""

from __future__ import annotations

import io
import zipfile
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import PipelineArtifact


def build_pipeline_artifacts_zip_bytes(
    artifacts: list["PipelineArtifact"],
    *,
    workspace_id: str,
    session_id: str,
    active_template_asset_id: str | None,
    resolve_storage_key,
) -> bytes:
    """
    Separate per-phase Markdown and optional Word files; includes MANIFEST.txt.

    resolve_storage_key: callable[str, Path]-like ``app.storage.resolve_storage_key``.
    """
    buf = io.BytesIO()
    manifest_lines = [
        "Federal SOW pipeline artifact package",
        f"session_id={session_id}",
        f"workspace_id={workspace_id}",
        "",
    ]

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for a in artifacts:
            stem = f"{a.phase_order:02d}_{a.agent_id}"
            md_name = f"{stem}.md"
            zf.writestr(md_name, (a.full_markdown or "").encode("utf-8"))

            if getattr(a, "exported_docx_key", None):
                p = resolve_storage_key(a.exported_docx_key)
                if p.is_file():
                    zf.write(p, arcname=f"{stem}_word_export.docx")

            note = ((getattr(a, "exported_docx_note", None) or "").replace("\n", " ")[:200])
            manifest_lines.append(
                f"phase {a.phase_order} | {a.agent_id} | md={md_name} | "
                f"word={'yes' if a.exported_docx_key else 'no'} | {note}"
            )

        manifest_lines.extend(["", f"active_template_asset_id={active_template_asset_id or 'none'}"])
        zf.writestr("MANIFEST.txt", "\n".join(manifest_lines).encode("utf-8"))

    return buf.getvalue()
