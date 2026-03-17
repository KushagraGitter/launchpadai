#!/usr/bin/env python3
"""
Create a LaunchPadAI task board in Notion.

Usage:
    NOTION_TOKEN=secret_xxx NOTION_PAGE_ID=<parent-page-id> python3 create_notion_board.py

Requirements:
    pip install notion-client

Environment variables:
    NOTION_TOKEN   — Notion integration token (Settings > Connections > Develop your own integrations)
    NOTION_PAGE_ID — Parent page ID where the database will be created
                     (copy from the URL: notion.so/workspace/<PAGE_ID>?...)
"""

import os
import sys

try:
    from notion_client import Client
except ImportError:
    print("notion-client not installed. Run: pip install notion-client")
    sys.exit(1)

NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
NOTION_PAGE_ID = os.environ.get("NOTION_PAGE_ID")

if not NOTION_TOKEN:
    print("Error: NOTION_TOKEN environment variable not set.")
    print("Get your token at: https://www.notion.so/my-integrations")
    sys.exit(1)

if not NOTION_PAGE_ID:
    print("Error: NOTION_PAGE_ID environment variable not set.")
    print("This is the parent page ID from the Notion URL.")
    sys.exit(1)

notion = Client(auth=NOTION_TOKEN)

# ─────────────────────────────────────────────────────────────────────────────
# Task data — LaunchPadAI feature & architecture analysis
# ─────────────────────────────────────────────────────────────────────────────
TASKS = [
    # Critical / Security
    {
        "title": "Add API rate limiting on auth + chat endpoints",
        "category": "Security",
        "priority": "Critical",
        "effort": "Medium",
        "description": "Auth endpoints (login, register, forgot-password) and chat endpoint have no rate limiting, creating brute-force and abuse risks. Implement token bucket or sliding window rate limiting per IP and per user.",
        "files": ["backend/app/api/routes/auth.py", "backend/app/api/routes/chat.py"],
    },
    {
        "title": "Enforce email verification on registration",
        "category": "Security",
        "priority": "Critical",
        "effort": "Low",
        "description": "auth.py:88 sets `email_verified=True` immediately on registration, completely bypassing the email verification flow that is otherwise implemented. Remove the hardcoded True and require users to verify before logging in.",
        "files": ["backend/app/api/routes/auth.py"],
    },
    {
        "title": "Server-side JWT token revocation on logout",
        "category": "Security",
        "priority": "High",
        "effort": "Medium",
        "description": "JWTs are stateless — logout currently just clears client storage but doesn't invalidate the token server-side. Implement a Redis-backed token denylist so stolen tokens can be revoked.",
        "files": ["backend/app/core/security.py", "frontend/src/lib/auth.ts"],
    },
    {
        "title": "Move JWT from sessionStorage to httpOnly cookies",
        "category": "Security",
        "priority": "High",
        "effort": "Medium",
        "description": "Storing access + refresh tokens in sessionStorage exposes them to XSS attacks. Migrate to httpOnly, SameSite=Strict cookies handled server-side.",
        "files": ["frontend/src/lib/api.ts", "frontend/src/lib/auth.ts", "backend/app/api/routes/auth.py"],
    },
    {
        "title": "Parameterize pgvector literal queries (SQL injection risk)",
        "category": "Security",
        "priority": "High",
        "effort": "Low",
        "description": "retriever.py uses string interpolation to build vector literals: `\"[\" + \",\".join(str(v) for v in query_vector) + \"]\"`. While floats are safe, this pattern is fragile. Use SQLAlchemy bindparams with cast to vector type.",
        "files": ["backend/app/rag/retriever.py"],
    },
    {
        "title": "Add input size limits and content validation",
        "category": "Security",
        "priority": "Medium",
        "effort": "Low",
        "description": "Project fields (raw_idea, constraints JSONB) and chat messages accept unbounded input. Add max length validation in Pydantic schemas and enforce at the model level.",
        "files": ["backend/app/schemas/project.py", "backend/app/schemas/chat.py"],
    },
    {
        "title": "Implement audit logging for sensitive operations",
        "category": "Security",
        "priority": "Medium",
        "effort": "Medium",
        "description": "No audit trail for artifact access, subscription changes, or admin actions. Add structured audit log records (who, what, when) to the database for compliance and incident investigation.",
        "files": ["backend/app/api/routes/subscriptions.py", "backend/app/api/routes/phases.py"],
    },

    # Testing
    {
        "title": "Add backend unit test suite (zero tests currently)",
        "category": "Testing",
        "priority": "Critical",
        "effort": "High",
        "description": "There are ZERO test files in the entire codebase. Implement pytest test suite covering: auth endpoints, project CRUD, phase state machine, RAG chunking, embedding generation, and service layer functions.",
        "files": ["backend/"],
    },
    {
        "title": "Add integration tests for phase execution pipeline",
        "category": "Testing",
        "priority": "High",
        "effort": "High",
        "description": "The CrewAI phase pipeline is the core value of the product but has no tests. Write integration tests that mock CrewAI/OpenAI and test the full flow: queue → worker → phase_runner → artifact storage → embedding.",
        "files": ["backend/app/services/phase_runner.py", "backend/app/worker.py"],
    },
    {
        "title": "Add frontend unit tests for key components",
        "category": "Testing",
        "priority": "High",
        "effort": "High",
        "description": "Frontend has no tests. Add Vitest/Jest tests for: ChatPanel SSE streaming, PhasePage state management, useAgentProgress WebSocket hook, and api.ts token refresh logic.",
        "files": ["frontend/src/"],
    },
    {
        "title": "Add E2E tests with Playwright",
        "category": "Testing",
        "priority": "Medium",
        "effort": "High",
        "description": "Write end-to-end tests for critical user journeys: registration → login → create project → run discovery phase → review → accept → run next phase.",
        "files": ["frontend/"],
    },

    # Infrastructure
    {
        "title": "Create Alembic database migration files",
        "category": "Infrastructure",
        "priority": "Critical",
        "effort": "Medium",
        "description": "The alembic/versions/ directory is empty — there are no migration files. Generate initial migration from current SQLAlchemy models and establish proper migration workflow for future schema changes.",
        "files": ["backend/alembic/"],
    },
    {
        "title": "Implement TypeScript/LangGraph agent-worker v2",
        "category": "Core Feature",
        "priority": "High",
        "effort": "High",
        "description": "The Python backend dispatches all jobs to `ideaos:phase_jobs_v2` queue (use_v2_worker=True by default) but no v2 worker implementation exists in the repository. The agent-worker/ directory has only a package.json placeholder. Build the LangGraph-based TypeScript worker.",
        "files": ["agent-worker/"],
    },
    {
        "title": "Add dead-letter queue and job retry logic for failed phases",
        "category": "Reliability",
        "priority": "High",
        "effort": "Medium",
        "description": "Failed phase jobs are just printed to stderr and dropped. Implement a dead-letter queue in Redis, automatic retry with exponential backoff (max 3 retries), and failure alerting.",
        "files": ["backend/app/worker.py"],
    },
    {
        "title": "Add Redis connection health monitoring and alerting",
        "category": "Reliability",
        "priority": "Medium",
        "effort": "Low",
        "description": "Redis is critical for job queuing and pub/sub but has no health monitoring. Add Redis ping checks to the readiness probe and alert on connection pool exhaustion.",
        "files": ["backend/app/main.py", "backend/app/worker.py"],
    },

    # Frontend Features
    {
        "title": "Build Settings page (currently empty placeholder)",
        "category": "Frontend",
        "priority": "High",
        "effort": "Medium",
        "description": "dashboard/settings/page.tsx is a placeholder stub. Implement full settings including: profile (name, email), password change, subscription management, notification preferences, and account deletion.",
        "files": ["frontend/src/app/dashboard/settings/page.tsx"],
    },
    {
        "title": "Implement project editing UI",
        "category": "Frontend",
        "priority": "High",
        "effort": "Low",
        "description": "The pencil icon in the project header has `title='Edit project'` but no onClick handler — it does nothing. Implement an edit modal/inline edit for project name, raw idea, domain, and target audience.",
        "files": ["frontend/src/app/project/[id]/page.tsx"],
    },
    {
        "title": "Implement Notifications panel",
        "category": "Frontend",
        "priority": "Medium",
        "effort": "Medium",
        "description": "The Bell icon in the project header is rendered but non-functional. Build a notification panel showing: phase completion events, review requests, subscription changes, and system alerts.",
        "files": ["frontend/src/app/project/[id]/page.tsx"],
    },
    {
        "title": "Add Constraints management UI",
        "category": "Frontend",
        "priority": "Medium",
        "effort": "Medium",
        "description": "User decisions/constraints are stored in projects.constraints (JSONB) and passed to agents, but there's no UI to view or edit them. Add a constraints panel showing active decisions and allowing users to override or delete them.",
        "files": ["frontend/src/app/project/[id]/page.tsx", "frontend/src/components/phases/"],
    },
    {
        "title": "Add project search and filter to dashboard",
        "category": "Frontend",
        "priority": "Medium",
        "effort": "Low",
        "description": "The dashboard project grid has no search or filter. Add search by name/idea text, filter by status (draft/active/completed), and sort options (newest/oldest/most recent activity).",
        "files": ["frontend/src/app/dashboard/page.tsx"],
    },
    {
        "title": "Replace 5s polling with WebSocket push for phase updates",
        "category": "Performance",
        "priority": "Medium",
        "effort": "Medium",
        "description": "The project page polls `/phases` every 5 seconds via setInterval. This is wasteful and adds latency. The WebSocket for agent progress is already implemented — extend it to also push phase status updates.",
        "files": ["frontend/src/app/project/[id]/page.tsx"],
    },

    # Performance
    {
        "title": "Add HNSW index to pgvector embeddings table",
        "category": "Performance",
        "priority": "High",
        "effort": "Low",
        "description": "The embeddings table uses exact cosine similarity search (pgvector `<=>` operator) without an index, causing full table scans as embeddings grow. Add an HNSW index: `CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops)`.",
        "files": ["backend/alembic/"],
    },
    {
        "title": "Add composite indexes for common query patterns",
        "category": "Performance",
        "priority": "Medium",
        "effort": "Low",
        "description": "Add missing DB indexes: `chat_messages(project_id, created_at)` for history queries, `embeddings(project_id, phase_type)` for RAG retrieval, `phases(project_id, phase_type, status)` for phase lookups.",
        "files": ["backend/alembic/"],
    },
    {
        "title": "Paginate chat history loading",
        "category": "Performance",
        "priority": "Medium",
        "effort": "Low",
        "description": "The chat history endpoint returns all messages without pagination. Long-running projects accumulate many messages, causing slow loads. Implement cursor-based pagination with a configurable limit.",
        "files": ["backend/app/api/routes/chat.py", "frontend/src/components/chat/ChatPanel.tsx"],
    },
    {
        "title": "Batch OpenAI embedding API calls",
        "category": "Performance",
        "priority": "Medium",
        "effort": "Low",
        "description": "Embeddings are generated per-artifact serially. OpenAI's embedding API supports batch requests. Batch all chunks from a phase run into a single API call to reduce latency and costs.",
        "files": ["backend/app/rag/embeddings.py"],
    },
    {
        "title": "Stream zip file generation for large artifact exports",
        "category": "Performance",
        "priority": "Low",
        "effort": "Low",
        "description": "export.py:65 builds the entire zip in memory via BytesIO before streaming. For large artifact sets this could OOM the process. Use streaming zip generation instead.",
        "files": ["backend/app/api/routes/export.py"],
    },

    # Observability
    {
        "title": "Integrate Sentry for error tracking",
        "category": "Observability",
        "priority": "High",
        "effort": "Low",
        "description": "The codebase has no error tracking service. Unhandled exceptions in the worker and API are printed to stderr and lost. Add Sentry SDK to both FastAPI (sentry-sdk[fastapi]) and Next.js frontends.",
        "files": ["backend/app/main.py", "frontend/src/app/layout.tsx"],
    },
    {
        "title": "Add structured JSON logging in worker and API",
        "category": "Observability",
        "priority": "Medium",
        "effort": "Low",
        "description": "The worker uses `print()` and `sys.stderr`. Replace with Python's logging module using JSON formatter (python-json-logger) for CloudWatch/ELK compatibility.",
        "files": ["backend/app/worker.py", "backend/app/main.py"],
    },
    {
        "title": "Add OpenTelemetry distributed tracing",
        "category": "Observability",
        "priority": "Medium",
        "effort": "High",
        "description": "There's no distributed tracing across API → Redis queue → worker → CrewAI. Add OpenTelemetry with auto-instrumentation for FastAPI, SQLAlchemy, Redis, and httpx clients.",
        "files": ["backend/app/main.py", "backend/app/worker.py"],
    },
    {
        "title": "Export Prometheus metrics endpoint",
        "category": "Observability",
        "priority": "Medium",
        "effort": "Medium",
        "description": "No metrics are collected. Add prometheus-fastapi-instrumentator to expose /metrics with: request latency, phase run durations, token usage per phase, error rates, and queue depth.",
        "files": ["backend/app/main.py"],
    },
    {
        "title": "Add LLM cost tracking and dashboard",
        "category": "Observability",
        "priority": "Medium",
        "effort": "Medium",
        "description": "AgentRun.token_usage field exists in the DB but is never populated. Track OpenAI token counts per agent run and expose a cost breakdown UI showing per-project and per-phase LLM spend.",
        "files": ["backend/app/services/phase_runner.py", "backend/app/models/agent_run.py"],
    },

    # Code Quality / Tech Debt
    {
        "title": "Deduplicate phase agent name definitions",
        "category": "Tech Debt",
        "priority": "Medium",
        "effort": "Low",
        "description": "Phase agent names are defined in 3 separate places: phase_runner.py PHASE_AGENT_NAMES, chat_orchestrator.py PHASE_AGENTS, and frontend PhasePage PHASE_META. Extract to a shared constants file and generate the frontend types from the backend schema.",
        "files": ["backend/app/services/phase_runner.py", "backend/app/services/chat_orchestrator.py"],
    },
    {
        "title": "Auto-generate TypeScript types from OpenAPI schema",
        "category": "Tech Debt",
        "priority": "Medium",
        "effort": "Medium",
        "description": "Frontend types in lib/api.ts are manually maintained and can drift from backend Pydantic schemas. Add openapi-typescript to generate types from the FastAPI OpenAPI spec at build time.",
        "files": ["frontend/src/lib/api.ts"],
    },
    {
        "title": "Split chat_orchestrator.py into focused modules",
        "category": "Tech Debt",
        "priority": "Medium",
        "effort": "High",
        "description": "chat_orchestrator.py is 54KB — a monolith containing: OpenAI client, function definitions, tool execution, SSE streaming, history management, and constraint updates. Split into: tool_definitions.py, tool_executor.py, history_manager.py, stream_handler.py.",
        "files": ["backend/app/services/chat_orchestrator.py"],
    },
    {
        "title": "Centralize configuration constants",
        "category": "Tech Debt",
        "priority": "Low",
        "effort": "Low",
        "description": "Magic numbers are scattered: 5-min stuck phase timeout (phases.py:36), 30s WebSocket heartbeat (websocket.py:184), 15s fallback polling (websocket.py:134), 1000-char embedding chunk size (embeddings.py:37). Move all to config.py with env var overrides.",
        "files": ["backend/app/core/config.py"],
    },
    {
        "title": "Fix inconsistent error handling across API routes",
        "category": "Tech Debt",
        "priority": "Medium",
        "effort": "Medium",
        "description": "Some routes raise HTTPException with proper status codes, others return unstructured error dicts, and some let exceptions propagate as 500s. Standardize using FastAPI exception handlers and consistent error response schemas.",
        "files": ["backend/app/api/routes/"],
    },
    {
        "title": "Generate OpenAPI documentation and expose /docs",
        "category": "Tech Debt",
        "priority": "Low",
        "effort": "Low",
        "description": "FastAPI auto-generates OpenAPI docs but they're not mentioned in CLAUDE.md and likely not served in production. Enable /docs and /redoc in non-production environments and document all endpoints with docstrings and examples.",
        "files": ["backend/app/main.py"],
    },

    # New Features
    {
        "title": "Team collaboration — project sharing and multi-user access",
        "category": "New Feature",
        "priority": "High",
        "effort": "High",
        "description": "Currently all projects are private to the creating user. Add team collaboration: invite team members by email, set roles (viewer/editor/admin), and allow multiple users to view and interact with the same project.",
        "files": ["backend/app/models/", "backend/app/api/routes/projects.py"],
    },
    {
        "title": "Full project export (all phases in one bundle)",
        "category": "New Feature",
        "priority": "Medium",
        "effort": "Low",
        "description": "Export endpoint only supports per-phase downloads. Add a project-level export that bundles all accepted phase artifacts into a single organized zip with an index.md overview.",
        "files": ["backend/app/api/routes/export.py"],
    },
    {
        "title": "PDF export format for phase artifacts",
        "category": "New Feature",
        "priority": "Low",
        "effort": "Low",
        "description": "Only zip and JSON exports are supported. Add PDF generation using weasyprint or reportlab so users can download beautifully formatted reports for stakeholder sharing.",
        "files": ["backend/app/api/routes/export.py"],
    },
    {
        "title": "Project templates for faster onboarding",
        "category": "New Feature",
        "priority": "Medium",
        "effort": "Medium",
        "description": "New users face a blank project creation form. Add pre-built templates (SaaS tool, mobile app, marketplace, API product) that pre-fill the idea, domain, and target audience fields to lower the barrier to entry.",
        "files": ["backend/app/api/routes/projects.py", "frontend/src/app/dashboard/page.tsx"],
    },
    {
        "title": "Slack/Discord integration for phase completion notifications",
        "category": "Integration",
        "priority": "Medium",
        "effort": "Medium",
        "description": "Long-running phases take minutes. Add webhook-based notifications to Slack/Discord when a phase completes or needs review, so users don't have to keep the browser open.",
        "files": ["backend/app/services/"],
    },
    {
        "title": "Admin dashboard for user and subscription management",
        "category": "New Feature",
        "priority": "Medium",
        "effort": "High",
        "description": "There's no admin interface to view all users, manage subscriptions, monitor phase execution health, or debug failed jobs. Build an admin-only dashboard with user management, subscription overrides, and worker queue monitoring.",
        "files": ["backend/app/api/routes/", "frontend/src/app/"],
    },
]

CATEGORIES = ["Security", "Testing", "Infrastructure", "Core Feature", "Frontend", "Performance",
               "Observability", "Tech Debt", "Reliability", "Integration", "New Feature"]
PRIORITIES = ["Critical", "High", "Medium", "Low"]
EFFORTS = ["Low", "Medium", "High"]


def create_database(parent_page_id: str) -> str:
    """Create the Notion database (board) with appropriate properties."""
    print("Creating Notion database...")

    database = notion.databases.create(
        parent={"type": "page_id", "page_id": parent_page_id},
        title=[{"type": "text", "text": {"content": "LaunchPadAI — Development Backlog"}}],
        properties={
            "Name": {"title": {}},
            "Status": {
                "select": {
                    "options": [
                        {"name": "Backlog", "color": "gray"},
                        {"name": "In Progress", "color": "blue"},
                        {"name": "In Review", "color": "yellow"},
                        {"name": "Done", "color": "green"},
                        {"name": "Blocked", "color": "red"},
                    ]
                }
            },
            "Priority": {
                "select": {
                    "options": [
                        {"name": "Critical", "color": "red"},
                        {"name": "High", "color": "orange"},
                        {"name": "Medium", "color": "yellow"},
                        {"name": "Low", "color": "blue"},
                    ]
                }
            },
            "Category": {
                "select": {
                    "options": [
                        {"name": cat, "color": "default"} for cat in CATEGORIES
                    ]
                }
            },
            "Effort": {
                "select": {
                    "options": [
                        {"name": "Low", "color": "green"},
                        {"name": "Medium", "color": "yellow"},
                        {"name": "High", "color": "red"},
                    ]
                }
            },
            "Affected Files": {"rich_text": {}},
        },
    )

    db_id = database["id"]
    print(f"Database created: {database['url']}")
    return db_id


def create_task(database_id: str, task: dict) -> None:
    """Create a single task page in the database."""
    files_str = ", ".join(task.get("files", []))

    notion.pages.create(
        parent={"database_id": database_id},
        properties={
            "Name": {
                "title": [{"type": "text", "text": {"content": task["title"]}}]
            },
            "Status": {
                "select": {"name": "Backlog"}
            },
            "Priority": {
                "select": {"name": task["priority"]}
            },
            "Category": {
                "select": {"name": task["category"]}
            },
            "Effort": {
                "select": {"name": task["effort"]}
            },
            "Affected Files": {
                "rich_text": [{"type": "text", "text": {"content": files_str}}]
            },
        },
        children=[
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": task["description"]},
                        }
                    ]
                },
            },
            {
                "object": "block",
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "Affected Files"}}]
                },
            },
            {
                "object": "block",
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [
                        {"type": "text", "text": {"content": f}} for f in task.get("files", [])
                    ]
                },
            },
        ],
    )
    print(f"  ✓ Created: {task['title']}")


def main():
    parent_id = NOTION_PAGE_ID.replace("-", "")
    if len(parent_id) == 32:
        parent_id = NOTION_PAGE_ID

    print(f"\nLaunchPadAI Notion Board Creator")
    print(f"Parent page: {parent_id}")
    print(f"Tasks to create: {len(TASKS)}\n")

    db_id = create_database(parent_id)

    print(f"\nCreating {len(TASKS)} tasks...")
    for i, task in enumerate(TASKS, 1):
        print(f"[{i}/{len(TASKS)}]", end=" ")
        try:
            create_task(db_id, task)
        except Exception as e:
            print(f"  ✗ FAILED: {task['title']} — {e}")

    print(f"\n✅ Done! {len(TASKS)} tasks created in Notion.")
    print(f"Open: https://notion.so/{db_id.replace('-', '')}")


if __name__ == "__main__":
    main()
