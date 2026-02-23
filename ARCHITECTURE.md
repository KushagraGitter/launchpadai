# LaunchPadAI — System Architecture

## Overview

LaunchPadAI is an AI-native SaaS platform that guides indie developers and small startup teams from raw idea validation through PRD generation, coding context export, and go-to-market execution. Every phase is powered by multi-agent AI pipelines with cross-phase context continuity via pgvector retrieval.

---

## High-Level Architecture

```mermaid
graph TB
    subgraph Client["Frontend — Next.js 14"]
        LP[Landing Page]
        AUTH[Auth Pages]
        DASH[Dashboard]
        PROJ[Project View]
        CHAT[Chat Panel]
        CANVAS[Workflow Canvas]
    end

    subgraph API["Backend — FastAPI"]
        GW[API Gateway / CORS]
        AR[Auth Routes]
        PR[Project Routes]
        PHR[Phase Routes]
        CR[Chat Routes — SSE]
        WS[WebSocket — Progress]
        EX[Export Routes]
    end

    subgraph Services["Services Layer"]
        CO[Chat Orchestrator]
        PHE[Phase Runner]
        RAG[RAG Retriever]
        EMB[Embedding Generator]
    end

    subgraph AI["AI Layer"]
        OAI[OpenAI GPT-4o]
        CREW[CrewAI Crews]
        AGENTS[Specialized Agents x16]
        EMBED[text-embedding-3-small]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL 16 + pgvector)]
        REDIS[(Redis 7)]
    end

    subgraph Worker["Background Worker"]
        WK[Queue Consumer]
    end

    Client -->|HTTPS| GW
    GW --> AR & PR & PHR & CR & WS & EX
    CR --> CO
    CO -->|Function Calling| OAI
    CO -->|start_phase| PHR
    PHR -->|dispatch job| REDIS
    REDIS -->|brpop| WK
    WK --> PHE
    PHE --> CREW
    CREW --> AGENTS
    AGENTS --> OAI
    PHE --> EMB
    EMB --> EMBED
    PHE -->|store artifacts| PG
    EMB -->|store vectors| PG
    RAG -->|cosine search| PG
    PHE -->|prior context| RAG
    AR & PR & PHR -->|read/write| PG
    CO -->|chat history| PG
    WS -->|poll phases| PG
```

---

## Data Flow — Phase Execution

```mermaid
sequenceDiagram
    actor User
    participant Chat as Chat Panel
    participant API as FastAPI
    participant LLM as GPT-4o
    participant Redis
    participant Worker
    participant CrewAI as CrewAI Crew
    participant DB as PostgreSQL
    participant Canvas as Workflow Canvas

    User->>Chat: "Let's start validation"
    Chat->>API: POST /chat (SSE)
    API->>LLM: Chat + function calling
    LLM-->>API: call start_phase("validation")
    API->>DB: INSERT phase (queued)
    API->>Redis: LPUSH phase_job
    API-->>Chat: stream "Starting validation..."
    Chat-->>Canvas: onPhaseStarted → refresh

    Redis->>Worker: BRPOP job
    Worker->>DB: UPDATE phase → running
    Worker->>CrewAI: kickoff()

    loop For each agent (4 agents)
        CrewAI->>LLM: Agent task prompt
        LLM-->>CrewAI: Agent output
    end

    Worker->>DB: INSERT artifacts
    Worker->>DB: INSERT embeddings (pgvector)
    Worker->>DB: UPDATE phase → completed

    Canvas->>API: GET /phases (poll 5s)
    API-->>Canvas: phases with status
    Canvas-->>User: ✅ Phase complete

    User->>Chat: "Show me the results"
    Chat->>API: POST /chat
    API->>LLM: call get_phase_results("validation")
    API->>DB: SELECT artifacts
    API-->>Chat: stream results summary
```

---

## Component Architecture

### Frontend (Next.js 14 App Router)

```
src/
├── app/
│   ├── layout.tsx              Root layout
│   ├── page.tsx                Landing page
│   ├── auth/
│   │   ├── login/page.tsx      JWT login
│   │   └── signup/page.tsx     Registration
│   ├── dashboard/
│   │   ├── layout.tsx          Auth guard + nav
│   │   └── page.tsx            Project grid
│   └── project/
│       └── [id]/page.tsx       Chat + Canvas split view
├── components/
│   ├── chat/
│   │   └── ChatPanel.tsx       Streaming chat with AI co-founder
│   └── canvas/
│       └── WorkflowCanvas.tsx  Phase nodes + artifact viewer
├── hooks/
│   └── useAgentProgress.ts     WebSocket for live progress
└── lib/
    ├── api.ts                  REST + SSE client
    ├── auth.ts                 Zustand auth store
    └── utils.ts                Helpers
```

### Backend (FastAPI + Python 3.12)

```
app/
├── main.py                     FastAPI app + CORS + routers
├── core/
│   ├── config.py               Pydantic Settings (.env)
│   ├── database.py             SQLAlchemy async engine
│   └── security.py             Argon2 + JWT (HS256)
├── models/
│   ├── user.py                 User model
│   ├── project.py              Project model
│   ├── phase.py                Phase model + PhaseType enum
│   ├── artifact.py             Artifact model (JSONB + markdown)
│   ├── agent_run.py            Agent execution tracking
│   ├── embedding.py            pgvector embeddings (1536-dim)
│   └── chat_message.py         Chat history
├── schemas/                    Pydantic request/response schemas
├── api/
│   ├── deps.py                 Auth dependency
│   └── routes/
│       ├── auth.py             Register / login / refresh / me
│       ├── projects.py         CRUD
│       ├── phases.py           Run / list / detail / artifacts
│       ├── chat.py             SSE streaming chat
│       ├── websocket.py        Live agent progress
│       └── export.py           ZIP / JSON export
├── services/
│   ├── phase_runner.py         CrewAI orchestration + artifact storage
│   └── chat_orchestrator.py    GPT-4o with function calling
├── agents/
│   ├── base.py                 Shared LLM config + helpers
│   ├── validation/crew.py      4 agents: market, feasibility, persona, synthesizer
│   ├── prd/crew.py             4 agents: requirements, prioritizer, UX, writer
│   ├── coding_context/crew.py  4 agents: architect, schema, decomposer, packager
│   └── gtm/crew.py             4 agents: positioning, channels, content, launch
├── rag/
│   ├── embeddings.py           Text chunking + OpenAI embeddings
│   └── retriever.py            pgvector cosine similarity search
└── worker.py                   Redis queue consumer
```

---

## AI Agent Architecture

```mermaid
graph LR
    subgraph Phase1["Phase 1: Idea Validation"]
        A1[Market Research Analyst]
        A2[Technical Feasibility Analyst]
        A3[User Persona Researcher]
        A4[Validation Synthesizer]
        A1 & A2 & A3 --> A4
    end

    subgraph Phase2["Phase 2: PRD Generation"]
        B1[Requirements Analyst]
        B2[Feature Prioritizer]
        B3[UX Flow Designer]
        B4[PRD Writer]
        B1 --> B2 --> B3 --> B4
    end

    subgraph Phase3["Phase 3: Coding Context"]
        C1[System Architect]
        C2[Schema Designer]
        C3[Task Decomposer]
        C4[Context Packager]
        C1 --> C2 --> C3 --> C4
    end

    subgraph Phase4["Phase 4: Go-to-Market"]
        D1[Positioning Strategist]
        D2[Channel Strategist]
        D3[Marketing Content Creator]
        D4[Launch Planner]
        D1 --> D2 --> D3 --> D4
    end

    Phase1 -->|RAG context| Phase2
    Phase2 -->|RAG context| Phase3
    Phase3 -->|RAG context| Phase4
```

Each phase runs a **CrewAI crew** of 4 specialized agents in sequential process. Agents within a crew share task context. Cross-phase context flows via **pgvector RAG** — after each phase completes, artifacts are chunked, embedded (text-embedding-3-small, 1536 dimensions), and stored. Subsequent phases retrieve the most relevant chunks using cosine similarity.

---

## Database Schema (ERD)

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ PHASES : has
    PROJECTS ||--o{ CHAT_MESSAGES : has
    PHASES ||--o{ ARTIFACTS : produces
    PHASES ||--o{ AGENT_RUNS : tracks
    ARTIFACTS ||--o{ EMBEDDINGS : indexed_by

    USERS {
        uuid id PK
        string email UK
        string password_hash
        string name
        timestamp created_at
    }

    PROJECTS {
        uuid id PK
        uuid user_id FK
        string name
        text raw_idea
        string domain
        text target_audience
        string status
        string current_phase
        timestamp created_at
        timestamp updated_at
    }

    PHASES {
        uuid id PK
        uuid project_id FK
        enum phase_type
        string status
        timestamp started_at
        timestamp completed_at
        timestamp created_at
    }

    ARTIFACTS {
        uuid id PK
        uuid phase_id FK
        string agent_name
        string artifact_type
        string title
        jsonb content
        text markdown_content
        timestamp created_at
    }

    AGENT_RUNS {
        uuid id PK
        uuid phase_id FK
        string crew_name
        string agent_name
        string status
        text output_summary
        timestamp started_at
        timestamp completed_at
    }

    EMBEDDINGS {
        uuid id PK
        uuid artifact_id FK
        uuid project_id FK
        string phase_type
        text chunk_text
        vector embedding
        jsonb metadata
        timestamp created_at
    }

    CHAT_MESSAGES {
        uuid id PK
        uuid project_id FK
        string role
        text content
        jsonb metadata
        timestamp created_at
    }
```

---

## Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js 14 (App Router) | SSR + client-side SPA |
| Backend | FastAPI (Python 3.12) | Async REST + SSE + WebSocket |
| Database | PostgreSQL 16 + pgvector | Relational data + vector search |
| Queue | Redis 7 | Background job dispatch |
| AI / LLM | OpenAI GPT-4o | Chat + agent reasoning |
| Embeddings | text-embedding-3-small | 1536-dim semantic vectors |
| Agent Framework | CrewAI | Multi-agent orchestration |
| Auth | JWT (HS256) + Argon2 | Stateless authentication |
| Styling | Tailwind CSS | Utility-first CSS |
| State | Zustand | Client-side auth state |

---

## Security Overview

- **Authentication**: JWT access/refresh tokens with Argon2id password hashing
- **Authorization**: Per-request user scoping on all endpoints
- **Transport**: HTTPS enforced, CORS restricted to allowed origins
- **Secrets**: Environment variables via `.env`, never in source
- **Database**: Parameterized queries via SQLAlchemy ORM
- **Sessions**: Tokens in `sessionStorage` (cleared on tab close)
- **API Keys**: OpenAI key server-side only, never exposed to client
