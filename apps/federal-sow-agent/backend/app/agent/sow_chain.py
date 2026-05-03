"""LangChain pipeline for federal Statement of Work drafting."""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.schemas import (
    IGCECostModel,
    MarketResearchModel,
    RequirementsAnalystModel,
    RequirementsDiscoveryModel,
    SOWSectionsModel,
)


def _merge_workspace_instructions(workspace_instructions: str | None, user_instructions: str) -> str:
    wi = (workspace_instructions or "").strip()[:8000]
    ui = user_instructions.strip()[:16000]
    if not wi:
        return ui
    if not ui:
        return "[Workspace-wide guidance — apply whenever this workspace runs]\n\n" + wi
    return (
        "[Workspace-wide guidance — apply whenever this workspace runs]\n\n"
        + wi
        + "\n\n---\n\nInstructions for this run:\n\n"
        + ui
    )


def _strip_json_fence(raw: str) -> str:
    raw = raw.strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", raw)
    if m:
        return m.group(1).strip()
    return raw


def _fallback_sections(output_schema: type[BaseModel], text: str) -> BaseModel:
    """Create a fallback instance of the appropriate schema with the raw text."""
    # Create instance with full_markdown containing the raw text
    data = {"full_markdown": text or "[No content generated]"}
    try:
        return output_schema(**data)
    except Exception:
        # If that fails, try with minimal fields
        return output_schema()


def run_specialist_chain(
    context_block: str,
    template_hints: str,
    user_instructions: str,
    system_prompt: str,
    output_schema: type[BaseModel],
    *,
    temperature: float = 0.2,
    workspace_instructions: str | None = None,
) -> tuple[BaseModel, list[str]]:
    """Run a pipeline specialist with a specific output schema.
    
    Args:
        context_block: Context documents text
        template_hints: Template heading hints
        user_instructions: User-provided instructions (includes prior pipeline output)
        system_prompt: Agent-specific system prompt
        output_schema: Pydantic model class for this specialist's output
        temperature: LLM temperature
        workspace_instructions: Global workspace instructions
        
    Returns:
        Tuple of (parsed model instance, warnings list)
    """
    warnings: list[str] = []
    context_block = context_block.strip()[:120000]
    template_hints = template_hints.strip()[:20000]
    user_instructions = _merge_workspace_instructions(workspace_instructions, user_instructions).strip()[:24000]

    has_azure_openai_config = bool(settings.azure_openai_endpoint and settings.azure_openai_deployment)
    if not settings.openai_api_key and not settings.azure_openai_api_key and not has_azure_openai_config:
        warnings.append(
            "LLM not configured (set OPENAI_API_KEY or Azure OpenAI env vars/managed identity). Returning structured placeholder."
        )
        return _fallback_sections(output_schema, "[LLM not configured]"), warnings

    parser = PydanticOutputParser(pydantic_object=output_schema)

    # Human prompt template - format instructions are added dynamically
    HUMAN_PROMPT_TEMPLATE = """Context documents (may include excerpts from PDFs, Word, spreadsheets, or OCR):

{context_block}

Template heading hints from the workspace ACTIVE reference file (DOCX headings, inferred PDF section lines, or Excel column/table preview). These define the expected document scaffold when present:

{template_hints}

User instructions for this phase (may include prior pipeline specialist output under a separator—treat that text as authoritative factual input):

{user_instructions}

Return JSON matching the schema described in the format instructions. The full_markdown field must contain the complete document in Markdown form for this specialist's specific deliverable.

{format_instructions}"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", HUMAN_PROMPT_TEMPLATE),
        ]
    )

    if has_azure_openai_config:
        from langchain_openai import AzureChatOpenAI

        azure_kwargs: dict[str, Any] = {}
        if settings.azure_openai_api_key:
            azure_kwargs["api_key"] = settings.azure_openai_api_key
        else:
            from azure.identity import DefaultAzureCredential, get_bearer_token_provider

            azure_kwargs["azure_ad_token_provider"] = get_bearer_token_provider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default",
            )

        llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_version=settings.azure_openai_api_version,
            azure_deployment=settings.azure_openai_deployment,
            temperature=temperature,
            **azure_kwargs,
        )
    else:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(model=settings.llm_model, api_key=settings.openai_api_key, temperature=temperature)

    chain = prompt | llm | parser

    try:
        raw = chain.invoke(
            {
                "context_block": context_block or "[No context documents]",
                "template_hints": template_hints or "[No template hints]",
                "user_instructions": user_instructions or "[Execute this pipeline phase.]",
                "format_instructions": parser.get_format_instructions(),
            }
        )
        if isinstance(raw, BaseModel):
            return raw, warnings
        if isinstance(raw, dict):
            return output_schema(**raw), warnings
        return output_schema.model_validate(raw), warnings
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
            return output_schema(**data), warnings
        except Exception as e2:
            warnings.append(f"Parse error: {e2}")
            return _fallback_sections(output_schema, context_block[:5000]), warnings
    except Exception as e:
        warnings.append(str(e))
        return _fallback_sections(output_schema, context_block[:5000]), warnings


# Backward compatibility: keep the old function name for existing code
def run_sow_chain(
    context_block: str,
    template_hints: str,
    user_instructions: str,
    system_prompt: str,
    *,
    temperature: float = 0.2,
    workspace_instructions: str | None = None,
) -> tuple[SOWSectionsModel, list[str]]:
    """Legacy entry point for SOW generation (used by non-pipeline routes)."""
    return run_specialist_chain(
        context_block=context_block,
        template_hints=template_hints,
        user_instructions=user_instructions,
        system_prompt=system_prompt,
        output_schema=SOWSectionsModel,
        temperature=temperature,
        workspace_instructions=workspace_instructions,
    )


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
