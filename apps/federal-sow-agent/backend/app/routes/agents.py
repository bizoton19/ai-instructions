from fastapi import APIRouter

from app.agents_config import AGENTS, DEFAULT_PIPELINE_SEQUENCE
from app.schemas import AgentBrief

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentBrief])
def list_agents():
    return [
        AgentBrief(id=key, name=p.name, description=p.description)
        for key, p in AGENTS.items()
    ]


@router.get("/pipeline")
def pipeline_definition():
    rows = []
    for i, aid in enumerate(DEFAULT_PIPELINE_SEQUENCE):
        profile = AGENTS.get(aid)
        rows.append(
            {
                "phase_order": i,
                "agent_id": aid,
                "valid": profile is not None,
                "name": profile.name if profile else "(unknown phase id)",
                "description": profile.description if profile else "",
            }
        )
    return rows
