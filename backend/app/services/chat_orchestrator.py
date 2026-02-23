"""Chat orchestrator: conversational AI that guides users through LaunchPadAI phases."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.artifact import Artifact
from app.models.chat_message import ChatMessage
from app.models.phase import Phase, PhaseType
from app.models.project import Project
from app.worker import dispatch_phase_job

PHASE_ORDER = [PhaseType.VALIDATION, PhaseType.PRD, PhaseType.CODING_CONTEXT, PhaseType.GTM]

PHASE_LABELS = {
    PhaseType.VALIDATION: "Idea Validation",
    PhaseType.PRD: "PRD Generation",
    PhaseType.CODING_CONTEXT: "Coding Context",
    PhaseType.GTM: "Go-to-Market",
}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "start_phase",
            "description": "Start executing a specific phase of the idea-to-production pipeline. Only call when the user agrees to proceed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "phase_type": {
                        "type": "string",
                        "enum": ["validation", "prd", "coding_context", "gtm"],
                        "description": "The phase to start",
                    }
                },
                "required": ["phase_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_phase_results",
            "description": "Retrieve the results/artifacts from a completed phase to discuss with the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "phase_type": {
                        "type": "string",
                        "enum": ["validation", "prd", "coding_context", "gtm"],
                    }
                },
                "required": ["phase_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ask_clarifying_questions",
            "description": "Ask the user clarifying questions to gather more context before starting a phase. Use this when you need more information about their idea, target market, technical preferences, or business model. Each question should have 2-4 selectable options plus an 'Other' option.",
            "parameters": {
                "type": "object",
                "properties": {
                    "context_message": {
                        "type": "string",
                        "description": "A brief message explaining why you're asking these questions.",
                    },
                    "questions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "question": {"type": "string"},
                                "options": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                            "required": ["id", "question", "options"],
                        },
                        "description": "List of questions with selectable options",
                    },
                },
                "required": ["context_message", "questions"],
            },
        },
    },
]


def _build_system_prompt(project: Project, phases: list[Phase]) -> str:
    completed = [p.phase_type.value for p in phases if p.status == "completed"]
    running = [p.phase_type.value for p in phases if p.status in ("queued", "running")]
    failed = [p.phase_type.value for p in phases if p.status == "failed"]

    next_phase = None
    for pt in PHASE_ORDER:
        if pt.value not in completed and pt.value not in running:
            next_phase = pt.value
            break

    return f"""You are an AI co-founder helping guide the user from idea to production. You're warm, insightful, and strategic.

PROJECT CONTEXT:
- Name: {project.name}
- Idea: {project.raw_idea}
- Domain: {project.domain or 'Not specified'}
- Target Audience: {project.target_audience or 'Not specified'}

PHASE PIPELINE (execute in order):
1. validation - Idea Validation (market research, technical feasibility, user personas, scorecard)
2. prd - PRD Generation (requirements, feature prioritization, UX flows, full PRD)
3. coding_context - Coding Context (system architecture, DB schema, task decomposition, dev package)
4. gtm - Go-to-Market (positioning, channels, content, launch plan)

CURRENT STATUS:
- Completed: {', '.join(completed) if completed else 'None'}
- Running: {', '.join(running) if running else 'None'}
- Failed: {', '.join(failed) if failed else 'None'}
- Next suggested phase: {next_phase or 'All phases complete!'}

INTERACTION RULES:
- IMPORTANT: Before starting ANY phase, ALWAYS use the ask_clarifying_questions tool to ask 2-3 relevant questions first. This gathers context that makes the AI agents produce much better output.
- For Idea Validation: Ask about revenue model, competitors they know of, unique differentiators, target market size expectations.
- For PRD: Ask about priority features, technical constraints, platform preferences (web/mobile/both), integration needs.
- For Coding Context: Ask about preferred tech stack, deployment preferences, scalability needs, team size.
- For Go-to-Market: Ask about budget, timeline, existing audience/channels, launch goals.
- Each question MUST include 2-4 concrete selectable options plus a general "Other" option.
- After the user answers the clarifying questions, THEN proceed to start the phase.
- When the user agrees to proceed after answering questions, call start_phase.
- After a phase completes, summarize key findings and suggest the next phase.
- If a phase is already running, tell the user to wait.
- Use markdown formatting for readability. Use headers, bullet points, and bold text.
- If the user asks about results, use get_phase_results to retrieve them.
- Don't repeat the full project context back unless asked.
- Be concise but insightful."""


async def _get_project_context(db: AsyncSession, project_id: uuid.UUID) -> tuple[Project, list[Phase]]:
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one()

    phases_result = await db.execute(
        select(Phase).where(Phase.project_id == project_id).order_by(Phase.created_at)
    )
    phases = list(phases_result.scalars().all())

    return project, phases


async def _get_chat_history(db: AsyncSession, project_id: uuid.UUID, limit: int = 30) -> list[dict]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    messages = list(reversed(result.scalars().all()))
    return [{"role": m.role, "content": m.content} for m in messages]


async def _handle_start_phase(
    db: AsyncSession, project_id: uuid.UUID, phase_type_str: str
) -> str:
    phase_type = PhaseType(phase_type_str)

    existing = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["queued", "running"]),
        )
    )
    if existing.scalars().first() is not None:
        return f"Phase '{PHASE_LABELS[phase_type]}' is already running. Please wait for it to complete."

    phase_idx = PHASE_ORDER.index(phase_type)
    if phase_idx > 0:
        prev_type = PHASE_ORDER[phase_idx - 1]
        prev = await db.execute(
            select(Phase).where(
                Phase.project_id == project_id,
                Phase.phase_type == prev_type,
                Phase.status == "completed",
            )
        )
        if prev.scalars().first() is None:
            return f"Cannot start '{PHASE_LABELS[phase_type]}' yet. '{PHASE_LABELS[prev_type]}' must be completed first."

    phase = Phase(
        project_id=project_id,
        phase_type=phase_type,
        status="queued",
        started_at=datetime.now(timezone.utc),
    )
    db.add(phase)
    await db.flush()
    await db.refresh(phase)

    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one()
    project.current_phase = phase_type.value
    project.status = "active"

    dispatch_phase_job(phase.id)
    await db.commit()

    return f"Started '{PHASE_LABELS[phase_type]}' phase. My team of AI agents is now analyzing your idea. This usually takes 1-2 minutes."


async def _handle_get_results(
    db: AsyncSession, project_id: uuid.UUID, phase_type_str: str
) -> str:
    phase_type = PhaseType(phase_type_str)

    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
        ).order_by(Phase.created_at.desc())
    )
    phase = result.scalars().first()
    if phase is None:
        return f"Phase '{PHASE_LABELS[phase_type]}' hasn't been started yet."

    if phase.status in ("queued", "running"):
        return f"Phase '{PHASE_LABELS[phase_type]}' is still running. Please wait for it to complete."

    if phase.status == "failed":
        return f"Phase '{PHASE_LABELS[phase_type]}' failed. You can try running it again."

    art_result = await db.execute(
        select(Artifact)
        .where(Artifact.phase_id == phase.id)
        .order_by(Artifact.created_at)
    )
    artifacts = list(art_result.scalars().all())

    if not artifacts:
        return f"Phase '{PHASE_LABELS[phase_type]}' completed but no artifacts were generated."

    summaries = []
    for art in artifacts:
        content = art.markdown_content or json.dumps(art.content) if art.content else "No content"
        if len(content) > 1500:
            content = content[:1500] + "..."
        summaries.append(f"### {art.title}\n{content}")

    return "\n\n---\n\n".join(summaries)


async def _handle_clarifying_questions(
    context_message: str, questions: list[dict]
) -> str:
    return json.dumps({
        "context_message": context_message,
        "questions": questions,
    })


async def chat_stream(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_message: str,
) -> AsyncIterator[str]:
    """Process a user message and stream the AI response."""

    user_msg = ChatMessage(
        project_id=project_id,
        role="user",
        content=user_message,
    )
    db.add(user_msg)
    await db.commit()

    project, phases = await _get_project_context(db, project_id)
    history = await _get_chat_history(db, project_id, limit=30)
    system_prompt = _build_system_prompt(project, phases)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=TOOLS,
        tool_choice="auto",
        stream=True,
        temperature=0.7,
        max_tokens=2000,
    )

    full_content = ""
    tool_calls_data: dict[int, dict[str, str]] = {}

    async for chunk in response:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta is None:
            continue

        if delta.content:
            full_content += delta.content
            yield json.dumps({"type": "token", "content": delta.content})

        if delta.tool_calls:
            for tc in delta.tool_calls:
                idx = tc.index
                if idx not in tool_calls_data:
                    tool_calls_data[idx] = {"id": "", "name": "", "arguments": ""}
                if tc.id:
                    tool_calls_data[idx]["id"] = tc.id
                if tc.function and tc.function.name:
                    tool_calls_data[idx]["name"] = tc.function.name
                if tc.function and tc.function.arguments:
                    tool_calls_data[idx]["arguments"] += tc.function.arguments

        if chunk.choices[0].finish_reason == "tool_calls":
            for _idx, tc_data in sorted(tool_calls_data.items()):
                fn_name = tc_data["name"]
                fn_args = json.loads(tc_data["arguments"])

                if fn_name == "start_phase":
                    yield json.dumps({
                        "type": "action",
                        "action": "phase_started",
                        "phase": fn_args["phase_type"],
                    })
                    fn_result = await _handle_start_phase(db, project_id, fn_args["phase_type"])
                elif fn_name == "get_phase_results":
                    fn_result = await _handle_get_results(db, project_id, fn_args["phase_type"])
                elif fn_name == "ask_clarifying_questions":
                    yield json.dumps({
                        "type": "questions",
                        "context_message": fn_args.get("context_message", ""),
                        "questions": fn_args.get("questions", []),
                    })
                    fn_result = await _handle_clarifying_questions(
                        fn_args.get("context_message", ""),
                        fn_args.get("questions", []),
                    )
                else:
                    fn_result = "Unknown function"

                followup_messages = messages + [
                    {"role": "assistant", "content": full_content, "tool_calls": [
                        {"id": tc_data["id"], "type": "function", "function": {"name": fn_name, "arguments": tc_data["arguments"]}}
                    ]},
                    {"role": "tool", "tool_call_id": tc_data["id"], "content": fn_result},
                ]

                followup = await client.chat.completions.create(
                    model="gpt-4o",
                    messages=followup_messages,
                    stream=True,
                    temperature=0.7,
                    max_tokens=2000,
                )

                async for followup_chunk in followup:
                    fd = followup_chunk.choices[0].delta if followup_chunk.choices else None
                    if fd and fd.content:
                        full_content += fd.content
                        yield json.dumps({"type": "token", "content": fd.content})

    if full_content:
        assistant_msg = ChatMessage(
            project_id=project_id,
            role="assistant",
            content=full_content,
        )
        db.add(assistant_msg)
        await db.commit()

    yield json.dumps({"type": "done"})
