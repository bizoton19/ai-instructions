from __future__ import annotations

from app.merge.template_markdown_merge import (
    build_master_template_markdown_from_outline,
    merge_flat_context_into_master_markdown,
)


def test_build_master_template_markdown_from_outline_uses_headings_and_slots():
    outline = {
        "kind": "pdf",
        "headings": ["1. Purpose", "2. Background", "3. Scope", "4. Deliverables"],
        "text_excerpt": "Sample source excerpt.",
    }
    md = build_master_template_markdown_from_outline(filename="agency-template.pdf", outline_obj=outline)
    assert "# Template Master: agency-template.pdf" in md
    assert "## 1. Purpose" in md
    assert "{{slot:purpose}}" in md
    assert "{{slot:deliverables}}" in md
    assert "Reference Excerpt" in md


def test_merge_flat_context_into_master_markdown_injects_sow_sections():
    master = (
        "# Template Master\n\n"
        "## Purpose\n\n{{slot:purpose}}\n\n"
        "## Scope\n\n{{slot:scope}}\n\n"
        "## Assumptions and Constraints\n\n{{slot:assumptions_and_constraints}}\n"
    )
    flat = {
        "purpose": "Deliver modernized SOW deliverables.",
        "scope": "Provide analysis, drafting, and review.",
        "assumptions_and_constraints": "Government furnishes source records.",
        "full_markdown": "# Should not be injected where keyed slots exist",
    }
    merged = merge_flat_context_into_master_markdown(master, flat)
    assert "{{slot:" not in merged
    assert "Deliver modernized SOW deliverables." in merged
    assert "Provide analysis, drafting, and review." in merged
    assert "Government furnishes source records." in merged


def test_merge_flat_context_into_master_markdown_uses_full_markdown_fallback_slot():
    master = "# Template Master\n\n## Body\n\n{{slot:full_markdown}}\n"
    flat = {"full_markdown": "## Generated Content\n\n- A\n- B"}
    merged = merge_flat_context_into_master_markdown(master, flat)
    assert "Generated Content" in merged
    assert "- A" in merged
