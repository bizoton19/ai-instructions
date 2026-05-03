"""ZIP packaging of per-phase pipeline artifacts."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from zipfile import ZipFile

from app.pipeline_zip import build_pipeline_artifacts_zip_bytes


def test_build_pipeline_artifacts_zip_bytes_includes_md_manifest_and_docx(tmp_path: Path) -> None:
    docx_path = tmp_path / "outputs" / "phase.docx"
    docx_path.parent.mkdir(parents=True, exist_ok=True)
    docx_path.write_bytes(b"PK\x03\x04 minimal docx-shaped bytes")

    artifacts = [
        SimpleNamespace(
            phase_order=0,
            agent_id="requirements_agent",
            full_markdown="# Phase zero",
            exported_docx_key="outputs/phase.docx",
            exported_docx_note="ok",
        ),
        SimpleNamespace(
            phase_order=1,
            agent_id="requirements_analyst",
            full_markdown="",
            exported_docx_key=None,
            exported_docx_note=None,
        ),
    ]

    def resolve(k: str) -> Path:
        return tmp_path / k

    payload = build_pipeline_artifacts_zip_bytes(
        artifacts,  # type: ignore[arg-type]
        workspace_id="w1",
        session_id="sess-1",
        active_template_asset_id="tpl-9",
        resolve_storage_key=resolve,
    )

    out_zip = tmp_path / "out.zip"
    out_zip.write_bytes(payload)

    with ZipFile(out_zip) as zf:
        names = set(zf.namelist())
        assert "00_requirements_agent.md" in names
        assert "00_requirements_agent_word_export.docx" in names
        assert "01_requirements_analyst.md" in names
        assert "MANIFEST.txt" in names
        manifest = zf.read("MANIFEST.txt").decode()
        assert "session_id=sess-1" in manifest
        assert "requirements_agent" in manifest
        assert "active_template_asset_id=tpl-9" in manifest
