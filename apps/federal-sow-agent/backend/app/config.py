import os
import sys
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./data/sow_agent.db"
    secret_key: str = "dev-secret-change-in-production-use-openssl-rand-hex-32"
    upload_dir: Path = Path(__file__).resolve().parent.parent / "uploads"
    data_dir: Path = Path(__file__).resolve().parent.parent / "data"
    max_upload_bytes: int = 25 * 1024 * 1024  # 25 MB

    llm_provider: str | None = Field(
        default=None,
        max_length=32,
        description="Required for the API server: openai | azure (set LLM_PROVIDER in .env).",
    )

    openai_api_key: str | None = None
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_deployment: str | None = None
    azure_openai_api_version: str = "2024-08-01-preview"
    llm_model: str = "gpt-4o-mini"

    session_cookie_name: str = "sow_session"
    session_max_age_seconds: int = 60 * 60 * 12  # 12 hours

    dev_login_email: str = "dev@example.gov"
    dev_login_password: str = "devpassword-change-me"
    cors_allow_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # LangSmith / LangChain tracing (optional). Set LANGCHAIN_TRACING_V2=true and LANGCHAIN_API_KEY in .env.
    langchain_tracing_v2: bool = False
    langchain_api_key: str | None = None
    langchain_project: str = "federal-sow-agent"


settings = Settings()


def exit_if_llm_not_configured() -> None:
    """
    Fail fast before serving traffic. Call from FastAPI startup only.
    Tests and one-off scripts may import the app without calling this.
    """
    raw = (settings.llm_provider or "").strip()
    if not raw:
        print(
            "FATAL: LLM provider not configured. Set LLM_PROVIDER=openai or LLM_PROVIDER=azure in backend/.env "
            "(see .env.example).",
            file=sys.stderr,
        )
        sys.exit(1)
    provider = raw.lower()
    if provider not in ("openai", "azure"):
        print(
            f"FATAL: LLM_PROVIDER must be openai or azure, got {raw!r}.",
            file=sys.stderr,
        )
        sys.exit(1)
    if provider == "azure":
        if not settings.azure_openai_endpoint or not settings.azure_openai_deployment:
            print(
                "FATAL: LLM_PROVIDER=azure requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT.",
                file=sys.stderr,
            )
            sys.exit(1)
        return
    if provider == "openai":
        if not settings.openai_api_key:
            print(
                "FATAL: LLM_PROVIDER=openai requires OPENAI_API_KEY.",
                file=sys.stderr,
            )
            sys.exit(1)


# Ensure OpenAI/LC client libraries pick up tracing before first LLM call.
if settings.langchain_tracing_v2 and (settings.langchain_api_key or "").strip():
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key.strip()
    if settings.langchain_project:
        os.environ["LANGCHAIN_PROJECT"] = settings.langchain_project.strip()
