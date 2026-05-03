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


def _lc_run_config(run_tags: list[str] | None) -> dict[str, object]:
    """LangSmith/LangChain tracing tags and run name (no PII)."""
    if not run_tags:
        return {}
    return {"tags": run_tags, "run_name": run_tags[-1]}


def run_specialist_chain(
    context_block: str,
    template_hints: str,
    user_instructions: str,
    system_prompt: str,
    output_schema: type[BaseModel],
    *,
    temperature: float = 0.2,
    workspace_instructions: str | None = None,
    run_tags: list[str] | None = None,
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
    template_hints = template_hints.strip()[:24000]
    user_instructions = _merge_workspace_instructions(workspace_instructions, user_instructions).strip()[:24000]

    provider = (settings.llm_provider or "").strip().lower()
    if provider not in ("openai", "azure"):
        warnings.append(
            "LLM provider not configured (set LLM_PROVIDER=openai or LLM_PROVIDER=azure for the API server)."
        )
        return (
            _fallback_sections(
                output_schema,
                "[LLM provider not configured — set LLM_PROVIDER in the API environment and restart the server.]",
            ),
            warnings,
        )

    if provider == "azure" and (not settings.azure_openai_endpoint or not settings.azure_openai_deployment):
        warnings.append("Azure OpenAI endpoint or deployment missing.")
        return (
            _fallback_sections(
                output_schema,
                "[LLM not configured — set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT.]",
            ),
            warnings,
        )

    if provider == "openai" and not settings.openai_api_key:
        warnings.append("OPENAI_API_KEY missing.")
        return (
            _fallback_sections(
                output_schema,
                "[LLM not configured — set OPENAI_API_KEY when LLM_PROVIDER=openai.]",
            ),
            warnings,
        )

    parser = PydanticOutputParser(pydantic_object=output_schema)

    # Human prompt template - format instructions are added dynamically
    HUMAN_PROMPT_TEMPLATE = """Context documents (may include excerpts from PDFs, Word, spreadsheets, or OCR):

{context_block}

Template heading hints from the workspace ACTIVE reference file (DOCX headings, inferred PDF section lines, or Excel column/table preview). These define the expected document scaffold when present:

{template_hints}

User instructions for this phase (may include prior pipeline specialist output under a separator—treat that text as authoritative factual input):

{user_instructions}

When template heading hints list section titles from the workspace reference file, mirror that outline in full_markdown using ## headings in a sensible order. Do not paste raw source documents verbatim as the deliverable; synthesize and draft new contract-ready text.

Prior pipeline output (if any) under User instructions repeats some of the same facts as the context documents. Treat both only as evidence: extract facts, decisions, and IDs you need, then write a **fresh** narrative for this specialist's role. In full_markdown, do not copy multi-paragraph stretches from prior phases or from context files as filler—rephrase, reorganize, and add tables or lists appropriate to **this** deliverable so each phase reads as distinct work product, not a duplicate of an earlier phase.

Return JSON matching the schema described in the format instructions. The full_markdown field must contain the complete document in Markdown form for this specialist's specific deliverable.

{format_instructions}"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", HUMAN_PROMPT_TEMPLATE),
        ]
    )

    if provider == "azure":
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
    invoke_cfg = _lc_run_config(run_tags)

    try:
        raw = chain.invoke(
            {
                "context_block": context_block or "[No context documents]",
                "template_hints": template_hints or "[No template hints]",
                "user_instructions": user_instructions or "[Execute this pipeline phase.]",
                "format_instructions": parser.get_format_instructions(),
            },
            config=invoke_cfg,
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
                },
                config=invoke_cfg,
            )
            content = getattr(msg, "content", str(msg))
            content = _strip_json_fence(content)
            data = json.loads(content)
            return output_schema(**data), warnings
        except Exception as e2:
            warnings.append(f"Parse error: {e2}")
            return (
                _fallback_sections(
                    output_schema,
                    f"[Model output could not be parsed as JSON for this specialist schema: {e2!s}]\n\n"
                    "The draft was not produced. Fix model access or simplify instructions and retry.",
                ),
                warnings,
            )
    except Exception as e:
        warnings.append(str(e))
        return (
            _fallback_sections(
                output_schema,
                f"[Generation failed: {e!s}]\n\n"
                "The server did not copy your source documents into this field. "
                "Check API keys, deployment name, network, and model availability, then retry.",
            ),
            warnings,
        )


# Backward compatibility: keep the old function name for existing code
def run_sow_chain(
    context_block: str,
    template_hints: str,
    user_instructions: str,
    system_prompt: str,
    *,
    temperature: float = 0.2,
    workspace_instructions: str | None = None,
    run_tags: list[str] | None = None,
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
        run_tags=run_tags,
    )


def sections_to_flat_dict(sections: SOWSectionsModel) -> dict[str, Any]:
    """Flatten structured SOW sections for Word export."""
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
