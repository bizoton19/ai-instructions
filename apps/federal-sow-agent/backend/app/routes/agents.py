from fastapi import APIRouter
from app.agents_config import AGENTS, AgentProfile

router = APIRouter(prefix="/agents", tags=["agents"])

@router.get("", response_model=list[AgentProfile])
def list_agents():
    return list(AGENTS.values())
