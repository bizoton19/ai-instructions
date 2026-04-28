"""LangChain pipeline for federal Statement of Work drafting."""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from pydantic import ValidationError

from app.config import settings
from app.schemas import SOWSectionsModel

SYSTEM_PROMPT = """You are an expert writer of U.S. federal Statements of Work (SOWs).
Write in clear plain language suitable for an informed federal audience (approximately eighth-grade reading level where practical).
Use professional contracting tone consistent with common federal practice (FAR-aware style only — you are not providing legal advice).

Rules:
- Produce factual, neutral language; flag uncertainties rather than inventing facts not supported by context.
- Prefer active voice and short sentences.
- Use consistent heading labels in the structured JSON fields.
- Populate full_markdown with a complete SOW-style document in Markdown with ## headings for major sections.

Return ONLY valid JSON matching the schema described in the human message. No markdown fences."""

HUMAN_PROMPT = """Context documents (may include excerpts from PDFs, Word, spreadsheets, or OCR):

{context_block}

Template heading hints (from uploaded Word templates, if any):

{template_hints}

User instructions for this draft:

{user_instructions}

Return JSON with keys:
purpose, background, scope, deliverables, period_of_performance,
roles_and_responsibilities, acceptance_criteria, assumptions_and_constraints,
full_markdown

Each field except full_markdown should be plain text (paragraphs allowed). full_markdown must be complete Markdown for the SOW."""


def _fallback_sections(text: str) -> SOWSectionsModel:
    return SOWSectionsModel(
        purpose="",
        background="",
        scope=text[:8000] if text else "",
        deliverables="",
        period_of_performance="",
        roles_and_responsibilities="",
        acceptance_criteria="",
        assumptions_and_constraints="",
        full_markdown=text or "[No content generated]",
    )


def _strip_json_fence(raw: str) -> str:
    raw = raw.strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", raw)
    if m:
        return m.group(1).strip()
    return raw


def run_sow_chain(
    context_block: str,
    template_hints: str,
    user_instructions: str,
) -> tuple[SOWSectionsModel, list[str]]:
    warnings: list[str] = []
    context_block = context_block.strip()[:120000]
    template_hints = template_hints.strip()[:20000]
    user_instructions = user_instructions.strip()[:16000]

    if not settings.openai_api_key and not settings.azure_openai_api_key:
        warnings.append(
            "LLM not configured (set OPENAI_API_KEY or Azure OpenAI env vars). Returning structured placeholder."
        )
        stub = (
            "## Purpose\n\n(Configured LLM required for generation.)\n\n"
            "## Scope\n\nBased on provided context length: "
            f"{len(context_block)} characters.\n"
        )
        return (
            SOWSectionsModel(
                purpose="LLM not configured.",
                scope="Provide OPENAI_API_KEY (or Azure OpenAI settings) on the server.",
                full_markdown=stub,
            ),
            warnings,
        )

    parser = PydanticOutputParser(pydantic_object=SOWSectionsModel)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT + "\n\n{format_instructions}"),
        ]
    )

    if settings.azure_openai_endpoint and settings.azure_openai_api_key and settings.azure_openai_deployment:
        from langchain_openai import AzureChatOpenAI

        llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version="2024-08-01-preview",
            azure_deployment=settings.azure_openai_deployment,
            temperature=0.2,
        )
    else:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(model=settings.llm_model, api_key=settings.openai_api_key, temperature=0.2)

    chain = prompt | llm | parser

    try:
        raw = chain.invoke(
            {
                "context_block": context_block or "[No context documents]",
                "template_hints": template_hints or "[No template hints]",
                "user_instructions": user_instructions or "[No additional instructions]",
                "format_instructions": parser.get_format_instructions(),
            }
        )
        if isinstance(raw, SOWSectionsModel):
            return raw, warnings
        if isinstance(raw, dict):
            sections = SOWSectionsModel(**raw)
            return sections, warnings
        sections = SOWSectionsModel.model_validate(raw)
        return sections, warnings
    except ValidationError as e:
        warnings.append(f"Structured parse fallback: {e}")
        try:
            llm_only = prompt | llm
            msg = llm_only.invoke(
                {
                    "context_block": context_block or "[No context documents]",
                    "template_hints": template_hints or "[No template hints]",
                    "user_instructions": user_instructions
                    or "[Return JSON only per format instructions]",
                    "format_instructions": parser.get_format_instructions(),
                }
            )
            content = getattr(msg, "content", str(msg))
            content = _strip_json_fence(content)
            data = json.loads(content)
            return SOWSectionsModel(**data), warnings
        except Exception as e2:
            warnings.append(f"Parse error: {e2}")
            return _fallback_sections(context_block[:5000]), warnings
    except Exception as e:
        warnings.append(str(e))
        return _fallback_sections(context_block[:5000]), warnings


def sections_to_flat_dict(sections: SOWSectionsModel) -> dict[str, Any]:
    """Flatten for docxtpl variable substitution."""
    return {
        "purpose": sections.purpose,
        "background": sections.background,
        "scope": sections.scope,
        "deliverables": sections.deliverables,
        "period_of_performance": sections.period_of_performance,
        "roles_and_responsibilities": sections.roles_and_responsibilities,
        "acceptance_criteria": sections.acceptance_criteria,
        "assumptions_and_constraints": sections.assumptions_and_constraints,
        "full_markdown": sections.full_markdown,
    }
