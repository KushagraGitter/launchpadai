# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LaunchPadAI** is an AI-native SaaS platform that guides developers through a complete product lifecycle: idea validation → PRD generation → coding context export → go-to-market execution. Each phase is powered by a CrewAI multi-agent pipeline, with cross-phase context continuity via pgvector embeddings (RAG).

## Development Commands

### Backend (FastAPI + Python 3.12)

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"  # Generate new migration

# Run services
uvicorn app.main:app --reload          # API server (port 8000)
python -m app.worker                   # Background job consumer

# Docker-based local dev (recommended)
docker compose up -d postgres redis    # Start dependencies only
docker compose up                      # Start all services
```

### Frontend (Next.js 14 + TypeScript)

```bash
cd frontend
npm install
npm run dev      # Dev server (port 3000)
npm run build    # Production build
npm run lint     # ESLint
```

### Environment Setup

Copy `backend/.env.example` to `backend/.env`. Required keys:
- `DATABASE_URL` / `DATABASE_URL_SYNC` — PostgreSQL (async + sync for Alembic)
- `REDIS_URL` — Redis job queue
- `OPENAI_API_KEY` — GPT-4o + embeddings
- `TAVILY_API_KEY` — Web search tool for agents
- `SECRET_KEY` — JWT signing key
- `CORS_ORIGINS` — Comma-separated frontend origins

Frontend: set `NEXT_PUBLIC_API_URL` to point at the backend.

## Architecture

### Request Flow

```
Next.js 14 (App Router)
    ↓ JWT auth
FastAPI (REST + WebSocket + SSE)
    ├── Phase trigger → Redis job queue → Worker process → CrewAI crew
    └── Chat → Chat Orchestrator (OpenAI function calling + SSE streaming)
                    ↓
PostgreSQL 16 + pgvector  (artifacts, embeddings, chat history)
Redis 7                   (job queue, pub/sub for real-time agent progress)
```

### Four-Phase Pipeline

Each phase is a **CrewAI crew** of 4 agents running in sequential process:

| Phase | Crew location | Output |
|-------|--------------|--------|
| Validation | `backend/app/agents/validation/crew.py` | Market analysis, feasibility, personas, go/no-go scorecard |
| PRD | `backend/app/agents/prd/crew.py` | Full Product Requirements Document |
| Coding Context | `backend/app/agents/coding_context/crew.py` | Architecture docs, `.cursorrules`, task decomposition |
| GTM | `backend/app/agents/gtm/crew.py` | Launch playbook, positioning, content strategy |

Phases are triggered via `POST /api/projects/{id}/phases/run`, enqueued in Redis, and consumed by `backend/app/worker.py`.

### Key Service Layer

- **`backend/app/services/phase_runner.py`** — Orchestrates crew execution: retrieves prior-phase context via RAG, runs the crew, stores artifacts in PostgreSQL, chunks and embeds artifact text into pgvector.
- **`backend/app/services/chat_orchestrator.py`** — Streams chat responses (SSE); uses OpenAI function calling to trigger phase runs; syncs agent progress via Redis pub/sub.
- **`backend/app/agents/base.py`** — Shared agent utilities: `get_llm()`, `TavilySearchTool`, `PhaseCallbackHandler` (Redis pub/sub progress), `build_context_string()`, `parse_agent_output()`.
- **`backend/app/rag/`** — `embeddings.py` (overlapping chunking + `text-embedding-3-small`) and `retriever.py` (pgvector cosine similarity search for cross-phase context injection).

### Database

SQLAlchemy async ORM with Alembic migrations. Core tables: `users`, `projects`, `phases`, `artifacts`, `agent_runs`, `embeddings` (pgvector 1536-dim), `chat_messages`, `subscriptions`.

Supabase compatibility: prepared statements disabled (`statement_cache_size=0` on the asyncpg pool), SSL context configured for the pooler.

### Real-time Updates

WebSocket endpoint `WS /api/ws/projects/{id}/agents` streams agent progress events. The worker publishes events to Redis pub/sub channel `project:{id}:agents`; the WebSocket handler subscribes and forwards to the client.

### Frontend State

Zustand for global state. Key hooks in `frontend/src/hooks/` handle phase polling, WebSocket subscriptions, and SSE chat streaming. API calls centralized in `frontend/src/lib/`.

## Important Patterns

- **Async throughout**: all DB access uses SQLAlchemy async sessions; the worker runs crews in a dedicated event loop thread to avoid blocking the main async loop.
- **Background jobs**: phase execution is always async (202 Accepted); never run a crew synchronously inside a FastAPI route handler.
- **Context injection**: every crew receives prior-phase artifact summaries retrieved from pgvector — preserve this pattern when adding new phases.
- **Artifact storage**: agents return structured output; `phase_runner.py` parses it, stores raw in `artifacts.content` (JSONB) and markdown in `artifacts.markdown_content`.
- **Migrations**: always generate a new Alembic revision for any model change; do not edit existing migration files.
