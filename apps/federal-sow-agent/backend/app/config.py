import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./data/sow_agent.db"
    secret_key: str = "dev-secret-change-in-production-use-openssl-rand-hex-32"
    upload_dir: Path = Path(__file__).resolve().parent.parent / "uploads"
    data_dir: Path = Path(__file__).resolve().parent.parent / "data"
    max_upload_bytes: int = 25 * 1024 * 1024  # 25 MB

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

# Ensure OpenAI/LC client libraries pick up tracing before first LLM call.
if settings.langchain_tracing_v2 and (settings.langchain_api_key or "").strip():
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key.strip()
    if settings.langchain_project:
        os.environ["LANGCHAIN_PROJECT"] = settings.langchain_project.strip()
