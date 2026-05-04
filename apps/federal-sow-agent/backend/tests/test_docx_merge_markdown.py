from __future__ import annotations

from docx import Document

from app.merge.docx_merge import standalone_docx_from_flat


def test_standalone_docx_renders_markdown_as_native_word_styles(tmp_path):
    out = tmp_path / "artifact.docx"
    flat = {
        "full_markdown": (
            "# Artifact Title\n\n"
            "## Findings\n\n"
            "- First bullet\n"
            "- Second **bold** bullet\n\n"
            "1. Numbered item\n"
            "2) Second numbered item\n\n"
            "A paragraph with *italics* and `code`.\n\n"
            "```json\n"
            '{"k":"v"}\n'
            "```\n"
        )
    }

    standalone_docx_from_flat(flat, out)
    doc = Document(str(out))
    paragraphs = [p for p in doc.paragraphs if p.text.strip()]
    texts = [p.text for p in paragraphs]
    styles = [p.style.name for p in paragraphs]

    # Markdown markers should not leak as literal body content.
    assert all(not t.lstrip().startswith(("# ", "## ", "- ", "1. ", "2) ", "```")) for t in texts)

    # Headings and list paragraphs should use native Word styles.
    assert "Heading 1" in styles or "Heading 2" in styles
    assert "List Bullet" in styles
    assert "List Number" in styles

    # Inline emphasis should map to runs.
    assert any(run.bold for p in paragraphs for run in p.runs if run.text.strip())
    assert any(run.italic for p in paragraphs for run in p.runs if run.text.strip())
    assert any((run.font.name or "") == "Courier New" for p in paragraphs for run in p.runs if run.text.strip())
