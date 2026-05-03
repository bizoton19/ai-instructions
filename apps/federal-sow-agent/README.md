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
- LangChain generation pipeline returns structured outputs per specialist and renders Markdown artifacts
- **Cross-phase grounding:** Downstream phases (especially `sow_writer` and `cost_estimator`) receive a bounded **Prior pipeline artifacts** block built from persisted `PipelineArtifact` rows (`full_markdown` and structured JSON), not only scrolling chat transcripts.
- Word export builds a `.docx` from drafting output (outline/boilerplate from the template feeds the **model**, not automated merge-field substitution into the template binary)
- **Session handoff package:** Operators download a **ZIP** (`GET .../pipeline/artifacts/package/download`) containing one Markdown file per phase, optional Word exports (`*_word_export.docx`), and `MANIFEST.txt`. A legacy **combined Markdown** download remains for quick search only.
- Prototype session-cookie authentication (development only)

## Stack

- Backend: FastAPI + SQLAlchemy + SQLite
- Frontend: React + Vite + USWDS
- Optional local infra: Docker Compose for Postgres and MinIO (not required in SQLite mode)

## PDF template versus DOCX template

The pipeline reads **heading structure** best from **Word (`.docx`)** templates. **PDF** templates only supply plain text plus guessed section lines, so the model gets weaker scaffolding.

If your agency shell is PDF-only, convert it to DOCX **once** on your machine, tidy headings in Word if needed, then upload the **DOCX** as the workspace template:

```bash
cd backend
pip install -r requirements-dev.txt
python scripts/pdf_template_to_docx.py /path/to/agency-shell.pdf -o /path/to/agency-shell.docx
```

Conversion uses `pdf2docx` (layout approximation, not pixel-perfect). Scanned PDFs, dense forms, and complex tables may need manual cleanup before you trust the outline.

## Run Backend

Use **Python 3.11** locally so your venv matches `backend/Dockerfile` (`python:3.11-slim`). With [pyenv](https://github.com/pyenv/pyenv), `cd backend` picks up `backend/.python-version`.

```bash
cd backend
python3.11 -m venv .venv   # or: pyenv install 3.11 && pyenv local 3.11 && python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set LLM_PROVIDER=openai or azure and the matching API keys (server exits on startup if unset).
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

## Artifact downloads (API orientation)

| Intent | Endpoint | Notes |
|--------|-----------|-------|
| One ZIP folder (preferred for records/handoff) | `GET /workspaces/{wid}/sessions/{sid}/pipeline/artifacts/package/download` | Separate `{phase}_{agent}.md`, optional `_word_export.docx`, plus `MANIFEST.txt` |
| One concatenated Markdown | `GET /workspaces/{wid}/sessions/{sid}/pipeline/artifacts/all/download` | All phases in a single `.md`; good for grep, weaker for file-boundary stewardship |
| Per-phase Markdown / Word | From `GET .../pipeline/artifacts` list response `download_url`, `merged_docx_download_url` | `word_export_note` carries last export outcome when Word is missing |

**Optional future work (Phase C-style):** true pixel-level reuse of agency Word layout (tables, numbering, locked styles) requires either injecting into the DOCX OOXML structure, templating markers agreed with counsel, or an external rendering service — only worthwhile after ZIP + contextual correctness stabilize.

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

