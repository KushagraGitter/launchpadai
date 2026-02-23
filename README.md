# LaunchPadAI

AI-native SaaS platform that guides indie developers and small startup teams from raw idea validation through PRD generation, coding context export, and go-to-market execution. Every phase is powered by multi-agent AI pipelines (CrewAI) with cross-phase context continuity via pgvector retrieval.

## Architecture

```
Next.js (Frontend) <-> FastAPI (Backend) <-> CrewAI (AI Agents)
                                          |
                        PostgreSQL + pgvector (Storage + Embeddings)
                                          |
                                  Redis (Job Queue)
```

### Four Phases

| Phase | Agents | Output |
|-------|--------|--------|
| 1. Idea Validation | Market Researcher, Feasibility Analyst, Persona Builder, Synthesizer | Validation scorecard with go/no-go |
| 2. PRD Generation | Requirements Analyst, Feature Prioritizer, UX Designer, PRD Writer | Complete PRD document |
| 3. Coding Context | Architect, Schema Designer, Task Decomposer, Context Packager | .cursorrules, architecture docs, task list |
| 4. Go-to-Market | Positioning Strategist, Channel Strategist, Content Creator, Launch Planner | Launch playbook with content |

### Cross-Phase Context (RAG)

Each phase's artifacts are chunked, embedded (OpenAI `text-embedding-3-small`), and stored in pgvector. Downstream phases retrieve relevant prior context via cosine similarity search, ensuring full continuity across the idea-to-production journey.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Backend**: Python 3.12, FastAPI, SQLAlchemy (async)
- **AI Agents**: CrewAI with OpenAI GPT-4o
- **Database**: PostgreSQL 16 + pgvector
- **Queue**: Redis
- **Auth**: JWT with Argon2 password hashing

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Python 3.12+
- OpenAI API key

### 1. Start Infrastructure

```bash
docker compose up -d postgres redis
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload

# In another terminal, start the worker
python -m app.worker
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Open the App

Visit `http://localhost:3000`

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get JWT tokens
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Projects
- `POST /api/projects` - Create project (submit idea)
- `GET /api/projects` - List projects
- `GET /api/projects/{id}` - Get project detail
- `PATCH /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

### Phases
- `POST /api/projects/{id}/phases/run` - Trigger a phase pipeline
- `GET /api/projects/{id}/phases` - List phases
- `GET /api/projects/{id}/phases/{type}` - Phase detail with artifacts
- `GET /api/projects/{id}/phases/{type}/artifacts` - List artifacts

### Export
- `GET /api/projects/{id}/export/{phase_type}?format=zip` - Download artifacts

### WebSocket
- `WS /api/ws/projects/{id}/agents` - Real-time agent progress

## Project Structure

```
LaunchPadAI/
├── frontend/                   # Next.js 14
│   └── src/
│       ├── app/                # Pages (landing, auth, dashboard, project)
│       ├── components/         # Shared UI components
│       ├── hooks/              # Custom hooks (WebSocket progress)
│       └── lib/                # API client, auth store, utils
│
├── backend/                    # FastAPI
│   └── app/
│       ├── api/routes/         # REST + WebSocket endpoints
│       ├── core/               # Config, database, security
│       ├── models/             # SQLAlchemy models
│       ├── schemas/            # Pydantic schemas
│       ├── agents/             # CrewAI crews (4 phases)
│       ├── rag/                # Embedding + pgvector retrieval
│       └── services/           # Phase runner orchestration
│
├── docker-compose.yml
└── README.md
```
