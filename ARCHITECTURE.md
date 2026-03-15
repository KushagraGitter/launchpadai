# LaunchPadAI — System Architecture

## Overview

LaunchPadAI is an AI-native SaaS platform that guides indie developers and small startup teams from raw idea validation through PRD generation, coding context export, and go-to-market execution. Every phase is powered by multi-agent AI pipelines with cross-phase context continuity via pgvector retrieval.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Browser["Browser — User"]
        U[("👤 User")]
    end

    subgraph Frontend["Frontend — Next.js 14 (App Router)"]
        LP["Landing Page\n/page.tsx"]
        AUTH["Auth Pages\n/auth/login  /auth/signup"]
        DASH["Dashboard\n/dashboard/page.tsx\nProject Grid + Create"]
        PROJ["Project View\n/project/[id]/page.tsx\nSplit: Chat | Canvas"]
        CHAT["ChatPanel.tsx\nSSE streaming\nPolling 4s"]
        CANVAS["WorkflowCanvas.tsx\nReactFlow nodes\nPolling 6s"]
        FEED["AgentActivityFeed.tsx\nLive event log"]
        ZUST["Zustand Store\nauth.ts\nJWT tokens"]
        APICLIENT["api.ts\nREST + SSE client\nAuto token refresh"]
        WSHOOK["useAgentProgress.ts\nWebSocket hook\nAuto-reconnect 5s"]
    end

    subgraph API["Backend — FastAPI (Python 3.12)"]
        CORS["CORS Middleware\nAllowed origins"]
        AUTHR["auth.py\nPOST /register\nPOST /login\nPOST /refresh\nGET /me"]
        PROJR["projects.py\nCRUD /projects"]
        PHASR["phases.py\nPOST /phases/run\nGET /phases\nPATCH /artifacts/{id}"]
        CHATR["chat.py\nPOST /chat (SSE)\nGET /chat/history"]
        WSR["websocket.py\nWS /ws/projects/{id}/agents\nJWT auth on connect"]
        EXPR["export.py\nGET /export/zip\nGET /export/json"]
        SUBR["subscriptions.py\nPlan management"]
        WEBHOOKR["webhooks.py\nRazorpay events"]
        DEPS["deps.py\nget_current_user()\nJWT decode"]
        SECURITY["security.py\nArgon2id hashing\nJWT HS256"]
    end

    subgraph Services["Services Layer"]
        CO["ChatOrchestrator\nchat_orchestrator.py\nGPT-4o function calling\nSSE streaming\nChat history"]
        PHR["PhaseRunner\nphase_runner.py\nCrew orchestration\nArtifact storage\nEmbedding pipeline"]
        RAZ["RazorpayService\nrazorpay_service.py\nPayment processing"]
    end

    subgraph RAG["RAG Pipeline"]
        EMBS["embeddings.py\ntext chunking\n1000 char / 100 overlap\nOpenAI embed call"]
        RET["retriever.py\nstore_embeddings()\nretrieve_context()\nget_phase_context()\ncosine similarity"]
    end

    subgraph Worker["Background Worker — worker.py"]
        WK["Queue Consumer\nBRPOP ideaos:phase_jobs\nThreadPoolExecutor\nFresh DB session/job"]
    end

    subgraph AI["AI / LLM Layer"]
        GPT4O["OpenAI GPT-4o\nChat reasoning\nFunction calling\nAgent task execution"]
        EMB3["text-embedding-3-small\n1536 dimensions\nSemantic vectors"]
        TAVILY["Tavily Search API\nWeb search tool\nMarket research"]
        CREWAI["CrewAI Framework\nSequential process\nShared task context"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL 16\n+ pgvector\nSupabase hosted\nPool: 20+10")]
        REDIS[("Redis 7\nJob queue\nPub/Sub channel\nproject:{id}:agents")]
    end

    subgraph Agents["Multi-Agent Pipelines"]
        subgraph V["Phase 1 — Validation"]
            V1["Market Research\nAnalyst"]
            V2["Technical Feasibility\nAnalyst"]
            V3["User Persona\nResearcher"]
            V4["Validation\nSynthesizer"]
        end
        subgraph P["Phase 2 — PRD"]
            P1["Requirements\nAnalyst"]
            P2["Feature\nPrioritizer"]
            P3["UX Flow\nDesigner"]
            P4["PRD\nWriter"]
        end
        subgraph C["Phase 3 — Coding Context"]
            C1["System\nArchitect"]
            C2["Schema\nDesigner"]
            C3["Task\nDecomposer"]
            C4["Context\nPackager"]
        end
        subgraph G["Phase 4 — GTM"]
            G1["Positioning\nStrategist"]
            G2["Channel\nStrategist"]
            G3["Marketing Content\nCreator"]
            G4["Launch\nPlanner"]
        end
    end

    %% User → Frontend
    U -->|HTTPS| LP
    U -->|HTTPS| AUTH
    AUTH -->|JWT stored| ZUST
    ZUST -->|token| APICLIENT
    DASH --> APICLIENT
    PROJ --> CHAT & CANVAS & FEED
    CHAT --> APICLIENT
    CANVAS --> APICLIENT
    FEED --> WSHOOK

    %% Frontend → API
    APICLIENT -->|REST / SSE| CORS
    WSHOOK -->|WebSocket| WSR
    CORS --> AUTHR & PROJR & PHASR & CHATR & EXPR & SUBR & WEBHOOKR

    %% Auth flow
    AUTHR --> SECURITY
    AUTHR --> PG
    DEPS --> SECURITY

    %% Chat flow
    CHATR --> CO
    CO -->|function calling| GPT4O
    CO -->|chat history read/write| PG
    CO -->|start_phase tool| PHASR

    %% Phase trigger
    PHASR -->|LPUSH ideaos:phase_jobs| REDIS
    PHASR -->|INSERT phase queued| PG

    %% Worker picks up job
    REDIS -->|BRPOP| WK
    WK -->|UPDATE phase → running| PG
    WK --> PHR

    %% PhaseRunner flow
    PHR -->|get_phase_context| RET
    RET -->|cosine search| PG
    PHR -->|kickoff crew| CREWAI
    CREWAI --> V & P & C & G
    V1 & V2 & V3 --> V4
    P1 --> P2 --> P3 --> P4
    C1 --> C2 --> C3 --> C4
    G1 --> G2 --> G3 --> G4

    %% Agents use tools
    V --> GPT4O & TAVILY
    P --> GPT4O
    C --> GPT4O
    G --> GPT4O & TAVILY

    %% Phase completes
    PHR -->|INSERT artifacts| PG
    PHR -->|chunk text| EMBS
    EMBS -->|embed chunks| EMB3
    EMBS -->|INSERT embeddings| PG
    PHR -->|UPDATE phase → completed| PG

    %% Real-time progress
    PHR -->|PUBLISH project:{id}:agents| REDIS
    REDIS -->|SUB events| WSR
    WSR -->|stream events| WSHOOK

    %% Export + Payments
    EXPR --> PG
    SUBR --> RAZ
    WEBHOOKR --> RAZ
    RAZ --> PG
```

---

## 2. Request Flow — Chat to Phase Execution (Sequence)

```mermaid
sequenceDiagram
    actor User
    participant ChatPanel as ChatPanel.tsx
    participant API as FastAPI /chat
    participant CO as ChatOrchestrator
    participant GPT as GPT-4o
    participant DB as PostgreSQL
    participant Redis
    participant Worker as worker.py
    participant PR as PhaseRunner
    participant Crew as CrewAI Crew
    participant RAG as RAG Retriever
    participant Embed as Embeddings
    participant WS as WebSocket /ws
    participant Canvas as WorkflowCanvas.tsx

    User->>ChatPanel: Types message
    ChatPanel->>API: POST /chat (SSE)
    API->>CO: chat_stream(project_id, message)
    CO->>DB: SELECT last 20 chat_messages
    CO->>DB: SELECT project + phases
    CO->>GPT: system_prompt + history + message\n[tools: start_phase, get_phase_results, ask_clarifying_questions]

    alt GPT calls ask_clarifying_questions
        GPT-->>CO: tool_call: ask_clarifying_questions(questions)
        CO-->>ChatPanel: SSE: type=questions, payload=[Q1,Q2,Q3]
        ChatPanel-->>User: Shows QuestionCards UI
        User->>ChatPanel: Selects answers
        ChatPanel->>API: POST /chat (follow-up)
    end

    alt GPT calls start_phase
        GPT-->>CO: tool_call: start_phase("validation")
        CO->>DB: INSERT phase (status=queued)
        CO->>Redis: LPUSH ideaos:phase_jobs {project_id, phase_type}
        CO-->>ChatPanel: SSE: "Starting validation phase..."
        ChatPanel-->>Canvas: trigger refresh
    end

    alt GPT calls get_phase_results
        GPT-->>CO: tool_call: get_phase_results("validation")
        CO->>DB: SELECT artifacts WHERE phase_type=validation
        CO-->>ChatPanel: SSE: stream artifact summary
    end

    CO->>DB: INSERT chat_message (user)
    CO->>DB: INSERT chat_message (assistant)
    CO-->>ChatPanel: SSE: stream tokens

    Note over Redis,Worker: Background job processing
    Redis->>Worker: BRPOP ideaos:phase_jobs (5s timeout)
    Worker->>DB: UPDATE phase → running
    Worker->>PR: run_phase(project_id, phase_type, session)

    PR->>RAG: get_phase_context(project_id, prev_phases)
    RAG->>DB: SELECT embeddings WHERE project_id\nORDER BY cosine_similarity DESC\nLIMIT top-K
    RAG-->>PR: context_string (prior phase summaries)

    PR->>DB: INSERT agent_runs (status=running) x4
    PR->>Crew: crew.kickoff(inputs={idea, context, domain})

    loop 4 Agents — Sequential
        Crew->>GPT: agent_role + task_description + context
        GPT-->>Crew: agent output text
        Crew->>Redis: PUBLISH project:{id}:agents {agent_name, status, output}
        Redis-->>WS: forward event
        WS-->>Canvas: WebSocket event: agent_complete
        Canvas-->>User: Live feed updates
    end

    Crew-->>PR: crew result (all 4 agent outputs)
    PR->>DB: INSERT artifacts (content JSONB + markdown_content)
    PR->>Embed: chunk_artifact(markdown_text)
    Embed->>GPT: POST /embeddings (text-embedding-3-small)
    GPT-->>Embed: [1536-dim vectors] per chunk
    Embed->>DB: INSERT embeddings (chunk_text, vector, metadata)
    PR->>DB: UPDATE phase → completed
    PR->>Redis: PUBLISH phase_complete event

    Canvas->>API: GET /phases (poll 6s)
    API-->>Canvas: phases with status=completed
    Canvas-->>User: Phase node turns green, artifacts visible
```

---

## 3. Agent Pipeline — Internal Detail

```mermaid
graph TB
    subgraph BASE["base.py — Shared Agent Utilities"]
        LLM["get_llm()\nChatOpenAI GPT-4o\ntemperature=0.7"]
        TOOL["TavilySearchTool\nWeb search wrapper\nmax_results=5"]
        CB["PhaseCallbackHandler\non_agent_action()\non_tool_end()\nPublish → Redis pub/sub"]
        CTX["build_context_string()\nFormat prior phase artifacts\nfor agent prompt injection"]
        PARSE["parse_agent_output()\nJSON parse → fallback raw text"]
    end

    subgraph PHASE_RUNNER["PhaseRunner — phase_runner.py"]
        MAP["CREW_MAP\nvalidation → ValidationCrew\nprd → PRDCrew\ncoding_context → CodingContextCrew\ngtm → GTMCrew"]
        RAGCTX["retrieve prior context\nRAG.get_phase_context()\nformat → context_string"]
        KICKOFF["crew_instance.kickoff(\n  inputs={\n    idea, domain,\n    target_audience,\n    context\n  }\n)"]
        STORE["For each crew result:\nparse_agent_output()\nINSERT artifact\n  .content = JSONB\n  .markdown_content = text\nINSERT agent_run record"]
        EMBEDPIPE["chunk_artifact(markdown)\nfor each chunk:\n  embed(chunk_text)\n  INSERT embedding\n  (vector + metadata)"]
    end

    subgraph V_CREW["Phase 1 — Validation Crew (crew.py)"]
        VA["Market Research Analyst\ngoal: market size, trends,\ncompetitors, TAM/SAM/SOM\ntool: TavilySearch"]
        VB["Technical Feasibility Analyst\ngoal: tech stack, complexity,\nbuild cost, risks\ntool: TavilySearch"]
        VC["User Persona Researcher\ngoal: ICP, pain points,\njobs-to-be-done\ntool: TavilySearch"]
        VD["Validation Synthesizer\ngoal: consolidate findings,\ngo/no-go scorecard (1-10),\nrecommendation\ninput: A+B+C outputs"]
        VA --> VD
        VB --> VD
        VC --> VD
    end

    subgraph P_CREW["Phase 2 — PRD Crew (crew.py)"]
        PA["Requirements Analyst\ngoal: functional + non-functional\nrequirements from idea + validation\ncontext"]
        PB["Feature Prioritizer\ngoal: MoSCoW framework\nMust/Should/Could/Won't\nwith rationale"]
        PC["UX Flow Designer\ngoal: user journeys,\nscreen flows, wireframe descriptions,\nkey interactions"]
        PD["PRD Writer\ngoal: full PRD document\nwith all sections\ninput: A→B→C outputs"]
        PA --> PB --> PC --> PD
    end

    subgraph C_CREW["Phase 3 — Coding Context Crew (crew.py)"]
        CA["System Architect\ngoal: architecture diagram,\ntech stack decisions,\nscalability plan"]
        CB2["Schema Designer\ngoal: DB schema,\nAPI contracts (OpenAPI),\ndata models"]
        CC["Task Decomposer\ngoal: sprint-ready tasks\nwith acceptance criteria,\npriority, effort estimate"]
        CD["Context Packager\ngoal: .cursorrules,\nCODING_CONTEXT.md,\nTASKS.json output"]
        CA --> CB2 --> CC --> CD
    end

    subgraph G_CREW["Phase 4 — GTM Crew (crew.py)"]
        GA["Positioning Strategist\ngoal: value proposition,\nmessaging framework,\ncompetitive differentiation\ntool: TavilySearch"]
        GB["Channel Strategist\ngoal: distribution channels,\nbudget allocation,\nacquisition strategy\ntool: TavilySearch"]
        GC["Marketing Content Creator\ngoal: landing page copy,\nsocial media posts,\nemail sequences"]
        GD["Launch Planner\ngoal: launch timeline,\nKPIs, OKRs,\ncontingency plans\ninput: A→B→C outputs"]
        GA --> GB --> GC --> GD
    end

    subgraph RAG_PIPE["RAG Pipeline — Cross-Phase Context"]
        CHUNK["chunk_artifact(text)\n1000 char max chunks\n100 char overlap\nSplit at sentence boundaries"]
        EMBED_CALL["OpenAI Embeddings API\ntext-embedding-3-small\n1536 dimensions\nper chunk"]
        STORE_VEC["INSERT embeddings\n  chunk_text\n  vector(1536)\n  phase_type\n  artifact_id\n  metadata JSONB"]
        SEARCH["cosine_similarity search\nSELECT top-K chunks\nFROM embeddings\nWHERE project_id = ?\nORDER BY vector <=> query_vec"]
        FORMAT["get_phase_context()\nFormat retrieved chunks\nas context string\nfor agent prompt injection"]
    end

    MAP --> RAGCTX
    RAGCTX --> FORMAT
    FORMAT --> KICKOFF
    KICKOFF --> V_CREW & P_CREW & C_CREW & G_CREW
    V_CREW & P_CREW & C_CREW & G_CREW --> STORE
    STORE --> EMBEDPIPE
    EMBEDPIPE --> CHUNK --> EMBED_CALL --> STORE_VEC
    STORE_VEC --> SEARCH
    LLM --> V_CREW & P_CREW & C_CREW & G_CREW
    TOOL --> VA & VB & VC & GA & GB
    CB --> V_CREW & P_CREW & C_CREW & G_CREW
```

---

## 4. Real-Time Communication Architecture

```mermaid
graph LR
    subgraph Frontend
        CANVAS["WorkflowCanvas\npoll GET /phases\nevery 6s"]
        FEED["AgentActivityFeed\nuseAgentProgress hook"]
        CHAT_UI["ChatPanel\npoll phase status\nevery 4s"]
        WSHOOK2["useAgentProgress.ts\nWebSocket client\nauto-reconnect 5s\nkeep last 50 events"]
    end

    subgraph Backend_RT["Backend — Real-time"]
        WSR2["websocket.py\nWS /ws/projects/{id}/agents\nJWT validate on connect\nRedis SUB loop\nDB snapshot fallback 8s"]
        PHASR2["phases.py\nGET /phases\nreturns phase statuses\nand artifacts"]
    end

    subgraph Worker_RT["Worker — Event Publishing"]
        CB_RT["PhaseCallbackHandler\non_agent_action → PUBLISH\non_tool_end → PUBLISH\non_agent_finish → PUBLISH"]
        WK_RT["worker.py\nphase_start event\nphase_complete event\nphase_error event"]
    end

    REDIS_RT[("Redis 7\nPub/Sub\nchannel:\nproject:{id}:agents")]

    CB_RT -->|PUBLISH| REDIS_RT
    WK_RT -->|PUBLISH| REDIS_RT
    REDIS_RT -->|SUBSCRIBE| WSR2
    WSR2 -->|WebSocket messages| WSHOOK2
    WSHOOK2 --> FEED
    CANVAS -->|HTTP poll| PHASR2
    CHAT_UI -->|HTTP poll| PHASR2

    subgraph Event_Types["WebSocket Event Types"]
        E1["phase_start\n{phase_type, status}"]
        E2["agent_start\n{agent_name, task}"]
        E3["agent_thinking\n{agent_name, thought}"]
        E4["agent_complete\n{agent_name, output_summary}"]
        E5["phase_complete\n{phase_type, artifact_count}"]
        E6["phase_error\n{phase_type, error}"]
        E7["snapshot\n{phases[], agent_runs[]}"]
    end

    WSR2 --> E1 & E2 & E3 & E4 & E5 & E6 & E7
```

---

## 5. Database Schema (ERD)

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ SUBSCRIPTIONS : has
    PROJECTS ||--o{ PHASES : has
    PROJECTS ||--o{ CHAT_MESSAGES : has
    PROJECTS ||--o{ EMBEDDINGS : has
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
        enum phase_type "validation|prd|coding_context|gtm"
        string status "queued|running|completed|failed"
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
        jsonb content "raw structured output"
        text markdown_content "editable markdown"
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
        vector embedding "1536 dim pgvector"
        jsonb metadata
        timestamp created_at
    }

    CHAT_MESSAGES {
        uuid id PK
        uuid project_id FK
        string role "user|assistant"
        text content
        jsonb metadata
        timestamp created_at
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid user_id FK
        string plan
        string status
        string razorpay_subscription_id
        timestamp current_period_end
        timestamp created_at
    }
```

---

## 6. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant Zustand as Zustand Store
    participant API as FastAPI
    participant Security as security.py
    participant DB as PostgreSQL

    User->>FE: POST /auth/register {email, password, name}
    FE->>API: POST /api/auth/register
    API->>Security: hash_password(password) Argon2id
    API->>DB: INSERT user
    API-->>FE: {access_token, refresh_token, user}
    FE->>Zustand: setTokens(access, refresh)
    Zustand->>Browser: sessionStorage.setItem

    Note over FE,API: Every subsequent request
    FE->>API: Authorization: Bearer {access_token}
    API->>Security: verify_token(token) JWT HS256
    API->>DB: SELECT user WHERE id = token.sub
    API-->>FE: 200 + response data

    Note over FE,API: Token expired (401)
    API-->>FE: 401 Unauthorized
    FE->>API: POST /auth/refresh {refresh_token}
    API->>Security: verify_token(refresh_token)
    API-->>FE: {new access_token}
    FE->>Zustand: update access_token
    FE->>API: Retry original request
```

---

## 7. Infrastructure Stack

| Component | Technology | Config |
|-----------|-----------|--------|
| Frontend | Next.js 14 App Router | Tailwind CSS, Zustand, ReactFlow |
| Backend | FastAPI Python 3.12 | Uvicorn, async SQLAlchemy |
| Database | PostgreSQL 16 + pgvector | Supabase, pool: 20+10, SSL |
| Queue | Redis 7 | BRPOP/LPUSH, Pub/Sub |
| AI Chat | OpenAI GPT-4o | Function calling, SSE streaming |
| AI Agents | CrewAI + GPT-4o | Sequential process, 4 agents/phase |
| Embeddings | text-embedding-3-small | 1536 dims, cosine similarity |
| Web Search | Tavily API | Used by validation + GTM agents |
| Auth | JWT HS256 + Argon2id | sessionStorage, auto-refresh |
| Payments | Razorpay | Subscriptions + webhooks |
| Containers | Docker + Docker Compose | backend, worker, frontend, db, redis |

---

## 8. Deployment Topology

```mermaid
graph TB
    subgraph Internet
        CDN["CDN / Vercel\nNext.js Frontend"]
    end

    subgraph Railway["Railway / Cloud"]
        BE["FastAPI\nBackend\nPort 8000"]
        WKR["Worker Process\nPython worker.py"]
    end

    subgraph Supabase["Supabase"]
        PGDB[("PostgreSQL 16\n+ pgvector\nPooler compatible")]
    end

    subgraph Redis_Cloud["Redis Cloud / Upstash"]
        RDB[("Redis 7\nJob queue\nPub/Sub")]
    end

    subgraph OpenAI_Cloud["OpenAI API"]
        OAI_API["GPT-4o\ntext-embedding-3-small"]
    end

    subgraph Tavily_Cloud["Tavily API"]
        TAV_API["Web Search"]
    end

    CDN -->|HTTPS API calls| BE
    BE -->|async queries| PGDB
    BE -->|LPUSH jobs| RDB
    WKR -->|BRPOP jobs| RDB
    WKR -->|PUBLISH events| RDB
    BE -->|SUBSCRIBE events| RDB
    WKR -->|INSERT artifacts| PGDB
    BE -->|OpenAI chat| OAI_API
    WKR -->|agent tasks + embeddings| OAI_API
    WKR -->|web search| TAV_API
```

---

## 9. Security Overview

- **Authentication**: JWT access/refresh tokens with Argon2id password hashing
- **Authorization**: Per-request user scoping on all endpoints via `deps.py`
- **Transport**: HTTPS enforced, CORS restricted to allowed origins
- **Secrets**: Environment variables via `.env`, never in source
- **Database**: Parameterized queries via SQLAlchemy ORM
- **Sessions**: Tokens in `sessionStorage` (cleared on tab close)
- **API Keys**: OpenAI/Tavily keys server-side only, never exposed to client
- **Payments**: Razorpay webhook endpoint at `/api/webhooks/razorpay`
