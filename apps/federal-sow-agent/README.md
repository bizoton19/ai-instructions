# Federal SOW Writer Agent

Prototype full-stack application for generating U.S. federal-style Statements of Work using uploaded context documents and Word templates.

## Features

- **Pipeline phase 1 (Requirements Discovery)** classifies uploaded context (spec, guide, architecture, ERD, and so on), frames the likely IT project posture (net-new, modernization, sustainment), and only then produces the clarification document. That phase acts as the built-in orchestration step; add a separate orchestrator only if you need an extra model pass before phase 1.
- Optional **workspace agent instructions** (settings): paste agency-specific rules, evaluation factors, or “always assume cloud/AI review” language; they are prepended to every generate and pipeline step.
- Multiple workspaces and agent sessions
- Separate upload areas for:
  - Context documents (`.pdf`, `.docx`, `.xlsx`, `.csv`, image files)
  - SOW templates (`.docx`)
- Server-side ingestion modules convert files to normalized text with provenance metadata
- LangChain generation pipeline returns structured SOW sections and markdown
- Word export from specialist drafts (template outline feeds the model; no merge-field mapping)
- Prototype session-cookie authentication (development only)

## Stack

- Backend: FastAPI + SQLAlchemy + SQLite
- Frontend: React + Vite + USWDS
- Optional local infra: Docker Compose for Postgres and MinIO (not required in SQLite mode)

## Run Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

API runs on `http://127.0.0.1:8000`.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

UI runs on `http://127.0.0.1:5173`.

## Prototype Authentication

- Default dev credentials:
  - Email: `dev@example.gov`
  - Password: `devpassword-change-me`
- For production/internal federal use, replace this with Microsoft Entra ID OIDC per `.cursor/rules/auth-internal.mdc`.

## Entra ID Migration Notes

1. Replace `/auth/login` prototype flow with OIDC authorization code flow.
2. Use Entra `oid` as durable user identifier.
3. Enforce HTTPS + secure cookies + CA policies in production.
4. Move secrets to agency-approved secrets manager.

