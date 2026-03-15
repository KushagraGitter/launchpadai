"""Chat orchestrator: conversational AI co-founder that drives product decisions."""

from __future__ import annotations

import json
import os
import ssl
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

import httpx
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


def _make_openai_client() -> AsyncOpenAI:
    """Create AsyncOpenAI with SSL cert bundle if configured (corporate proxy support)."""
    ca_bundle = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")

    # Also check the .env values directly (pydantic-settings loads them into settings
    # but doesn't export them to os.environ automatically)
    if not ca_bundle:
        # Try the known location relative to this file
        candidate = Path(__file__).parent.parent.parent / "certs" / "system_ca.pem"
        if candidate.exists():
            ca_bundle = str(candidate)

    if ca_bundle and Path(ca_bundle).exists():
        ssl_ctx = ssl.create_default_context(cafile=ca_bundle)
        http_client = httpx.AsyncClient(verify=ssl_ctx)
        return AsyncOpenAI(api_key=settings.OPENAI_API_KEY, http_client=http_client)

    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


from app.models.artifact import Artifact
from app.models.chat_message import ChatMessage
from app.models.phase import Phase, PhaseType
from app.models.phase_feedback import FeedbackType, PhaseFeedback
from app.models.project import Project
from app.worker import dispatch_phase_job

PHASE_ORDER = [PhaseType.DISCOVERY, PhaseType.VALIDATION, PhaseType.PRD, PhaseType.CODING_CONTEXT, PhaseType.GTM]

PHASE_LABELS = {
    PhaseType.DISCOVERY: "Discovery Session",
    PhaseType.VALIDATION: "Idea Validation",
    PhaseType.PRD: "PRD Generation",
    PhaseType.CODING_CONTEXT: "Coding Context",
    PhaseType.GTM: "Go-to-Market",
}

# Which agents belong to each phase — must stay in sync with phase_runner.py
PHASE_AGENTS = {
    "discovery": [
        "Problem Explorer",
        "Assumption Challenger",
        "Opportunity Mapper",
        "Brief Builder",
    ],
    "validation": [
        "Market Research Analyst",
        "Technical Feasibility Analyst",
        "User Persona Researcher",
        "Validation Synthesizer",
    ],
    "prd": [
        "Requirements Analyst",
        "Feature Prioritizer",
        "UX Flow Designer",
        "PRD Writer",
    ],
    "coding_context": [
        "System Architect",
        "Schema Designer",
        "Task Decomposer",
        "Context Packager",
    ],
    "gtm": [
        "Positioning Strategist",
        "Channel Strategist",
        "Marketing Content Creator",
        "Launch Planner",
    ],
}

# Human-readable explanation of what each agent produces
AGENT_DESCRIPTIONS = {
    "Problem Explorer": "problem statement, problem depth analysis, and evidence of problem reality",
    "Assumption Challenger": "assumptions inventory, risk tiering, and historical failure analysis",
    "Opportunity Mapper": "competitive landscape, whitespace analysis, and success criteria",
    "Brief Builder": "the complete Project Brief synthesising all discovery findings",
    "Market Research Analyst": "market size, competitive landscape, and market gaps",
    "Technical Feasibility Analyst": "technical stack, complexity, and infrastructure costs",
    "User Persona Researcher": "target user personas, pain points, and willingness to pay",
    "Validation Synthesizer": "overall go/no-go scorecard and recommendations",
    "Requirements Analyst": "product requirements and feature scope",
    "Feature Prioritizer": "MoSCoW feature prioritization",
    "UX Flow Designer": "user experience flows and interaction patterns",
    "PRD Writer": "the full product requirements document",
    "System Architect": "system architecture and component design",
    "Schema Designer": "database schema and API contracts",
    "Task Decomposer": "development task breakdown",
    "Context Packager": "IDE integration files and coding context",
    "Positioning Strategist": "positioning strategy and value propositions",
    "Channel Strategist": "marketing channels and distribution",
    "Marketing Content Creator": "marketing content, copy, and messaging",
    "Launch Planner": "launch timeline and action plan",
}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "start_phase",
            "description": "Start executing a full phase of the pipeline. Only call when the user explicitly agrees to run a full phase and no constraints have changed that would invalidate prior work.",
            "parameters": {
                "type": "object",
                "properties": {
                    "phase_type": {
                        "type": "string",
                        "enum": ["discovery", "validation", "prd", "coding_context", "gtm"],
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
            "name": "propose_targeted_rerun",
            "description": (
                "When the user changes a constraint or assumption that invalidates specific prior work, "
                "propose re-running only the affected agents rather than the full phase. "
                "Use this instead of start_phase when the user is refining rather than restarting. "
                "Present a clear explanation of WHY these specific agents are affected before proposing."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "phase_type": {
                        "type": "string",
                        "enum": ["discovery", "validation", "prd", "coding_context", "gtm"],
                        "description": "Which phase contains the agents to re-run",
                    },
                    "agent_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Exact agent names to re-run (must match PHASE_AGENTS keys)",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Clear explanation of what changed and why these specific agents are affected",
                    },
                    "invalidated_findings": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific findings from prior runs that this change would invalidate",
                    },
                },
                "required": ["phase_type", "agent_names", "reason", "invalidated_findings"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_project_constraints",
            "description": (
                "Persist a user decision or constraint to the project. "
                "Call this whenever the user confirms a key product decision: "
                "target segment, pricing model, tech stack choice, deployment preference, budget, etc. "
                "These constraints are injected into every future agent run for consistency."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "constraints": {
                        "type": "object",
                        "description": "Key-value pairs to merge into project constraints (e.g. {\"segment\": \"enterprise\", \"pricing\": \"subscription\"})",
                        "additionalProperties": {"type": "string"},
                    }
                },
                "required": ["constraints"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_phase_results",
            "description": "Retrieve the results/artifacts from a completed phase to discuss, critique, or compare with new constraints.",
            "parameters": {
                "type": "object",
                "properties": {
                    "phase_type": {
                        "type": "string",
                        "enum": ["discovery", "validation", "prd", "coding_context", "gtm"],
                    }
                },
                "required": ["phase_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "challenge_assumption",
            "description": (
                "Play devil's advocate on a specific assumption the user or prior agents have made. "
                "Use this proactively when you notice an untested assumption in the idea, a phase result, "
                "or something the user said. Surface the strongest counter-argument, then let the user respond. "
                "Don't wait to be asked — if you see a shaky assumption, challenge it."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "assumption": {
                        "type": "string",
                        "description": "The specific assumption being challenged (quote it directly)",
                    },
                    "challenge": {
                        "type": "string",
                        "description": "The devil's advocate counter-argument — the strongest case AGAINST this assumption",
                    },
                    "evidence": {
                        "type": "string",
                        "description": "Any evidence, examples, or analogies that support the challenge",
                    },
                    "question_to_user": {
                        "type": "string",
                        "description": "A single sharp question that forces the user to defend or reconsider the assumption",
                    },
                },
                "required": ["assumption", "challenge", "evidence", "question_to_user"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_alternatives",
            "description": (
                "Generate 2-3 meaningfully different alternative approaches for a specific aspect of the product. "
                "Use when the user seems locked into one direction, or when brainstorming before a phase. "
                "Each alternative should be genuinely distinct — different business model, different target segment, "
                "different technical approach, etc. Not just variations of the same idea."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "aspect": {
                        "type": "string",
                        "description": "The specific aspect being explored (e.g. 'monetization model', 'target segment', 'distribution channel')",
                    },
                    "current_direction": {
                        "type": "string",
                        "description": "What the user is currently assuming or planning for this aspect",
                    },
                    "alternatives": {
                        "type": "array",
                        "description": "2-3 alternative approaches",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "description": {"type": "string"},
                                "best_for": {"type": "string", "description": "When/why this alternative makes most sense"},
                                "tradeoff": {"type": "string", "description": "The key downside or risk"},
                            },
                            "required": ["name", "description", "best_for", "tradeoff"],
                        },
                    },
                    "recommendation": {
                        "type": "string",
                        "description": "Your honest recommendation and why, given what you know about this project",
                    },
                },
                "required": ["aspect", "current_direction", "alternatives", "recommendation"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_quick_research",
            "description": (
                "Run a lightweight web search to answer a specific factual question about the market, "
                "competitors, pricing, or technology — WITHOUT running a full phase. "
                "Use this to quickly ground a conversation in real data. "
                "Good for: 'who are the top competitors?', 'what do similar tools charge?', "
                "'is this technology mature enough?', 'how big is this market?'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The specific search query to run",
                    },
                    "purpose": {
                        "type": "string",
                        "description": "Why this research is relevant to the current conversation",
                    },
                },
                "required": ["query", "purpose"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_approaches",
            "description": (
                "Do a structured head-to-head comparison of two product directions, strategies, or technical choices. "
                "Use when the user is deciding between two options and needs a clear framework. "
                "Be concrete — use specific criteria relevant to THIS project, not generic pros/cons."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "option_a": {"type": "string", "description": "First option being compared"},
                    "option_b": {"type": "string", "description": "Second option being compared"},
                    "criteria": {
                        "type": "array",
                        "description": "3-5 specific evaluation criteria relevant to this project",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "a_score": {"type": "string", "description": "How A performs on this criterion"},
                                "b_score": {"type": "string", "description": "How B performs on this criterion"},
                                "winner": {"type": "string", "enum": ["A", "B", "tie"]},
                            },
                            "required": ["name", "a_score", "b_score", "winner"],
                        },
                    },
                    "verdict": {
                        "type": "string",
                        "description": "Your clear recommendation and the single most important reason",
                    },
                },
                "required": ["option_a", "option_b", "criteria", "verdict"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ask_clarifying_questions",
            "description": (
                "Ask structured clarifying questions before starting a phase or when brainstorming. "
                "Use when you need to understand the user's priorities, constraints, or preferences. "
                "Each question must have 3-4 concrete options."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "context_message": {
                        "type": "string",
                        "description": "Brief explanation of why you're asking",
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
                    },
                },
                "required": ["context_message", "questions"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_feedback_and_refine",
            "description": (
                "Submit structured feedback on specific sections of a completed phase's artifacts "
                "and trigger a targeted rerun of the affected agents. Use this when the user expresses "
                "dissatisfaction with specific parts of a phase result in conversation — for example, "
                "'the market size seems too optimistic' or 'the personas don't match my target audience'. "
                "Extract their feedback into section-level items before calling. "
                "Do NOT use this for general comments — only when the user wants specific sections improved."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "phase_type": {
                        "type": "string",
                        "enum": ["discovery", "validation", "prd", "coding_context", "gtm"],
                        "description": "The phase whose artifacts need refinement",
                    },
                    "feedback_items": {
                        "type": "array",
                        "description": "Structured feedback items extracted from the user's comments",
                        "items": {
                            "type": "object",
                            "properties": {
                                "section": {
                                    "type": "string",
                                    "description": "The artifact section heading this feedback applies to",
                                },
                                "feedback_type": {
                                    "type": "string",
                                    "enum": ["thumbs_up", "thumbs_down", "comment"],
                                    "description": "thumbs_down for sections that need rework, comment for suggestions",
                                },
                                "comment": {
                                    "type": "string",
                                    "description": "The user's specific feedback or concern about this section",
                                },
                            },
                            "required": ["section", "feedback_type"],
                        },
                    },
                    "agent_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Exact agent names to re-run (must match PHASE_AGENTS for this phase)",
                    },
                },
                "required": ["phase_type", "feedback_items", "agent_names"],
            },
        },
    },
]


def _build_proactive_instructions(
    project: Project,
    completed: list[str],
    running: list[str],
    next_phase: str | None,
    artifact_summaries: dict[str, str],
    is_first_message: bool,
) -> str:
    """
    Build context-specific proactive behaviour instructions based on where
    the user is in the pipeline. These replace generic instructions with
    situation-aware directives.
    """
    lines: list[str] = ["SITUATION-SPECIFIC INSTRUCTIONS (follow these for this conversation):"]

    # --- Pre-pipeline: no phases started yet ---
    if not completed and not running:
        lines.append(
            "STAGE: Discovery not started yet. Your job is to make the user curious and excited "
            "about running the Discovery Session FIRST — before anything else.\n"
            "- Read the idea carefully. Identify the 2-3 biggest gaps or ambiguities "
            "(e.g. undefined target segment, unclear monetization, no differentiation stated).\n"
            "- Surface these gaps proactively in your FIRST response.\n"
            "- Explain that Discovery Session is Phase 0 — a structured pre-flight that stress-tests "
            "the idea and produces a Project Brief used by all downstream phases.\n"
            "- Use `challenge_assumption` on the riskiest assumption before suggesting any phase run.\n"
            "- Suggest 'Let's explore your idea' as the first step — frame it as a conversation, not a run.\n"
            "- Do NOT suggest jumping straight to Validation."
        )

    # --- Discovery complete, Validation not started ---
    elif "discovery" in completed and "validation" not in completed and "validation" not in running:
        discovery_summary = artifact_summaries.get("discovery", "")
        lines.append(
            "STAGE: Discovery complete, Validation not started yet.\n"
            "- You now have a Project Brief. Reference it specifically in your response.\n"
            "- Surface the top 2 risks from the Brief's assumptions analysis.\n"
            "- Ask the user if the Brief's problem statement and target user feel right before proceeding.\n"
            "- If the user is satisfied, suggest running Idea Validation next.\n"
            "- Use `challenge_assumption` on any assumption in the Brief that looks shaky."
        )
        if discovery_summary:
            lines.append(f"Discovery context to draw from:\n{discovery_summary[:400]}")

    # --- Validation complete, PRD not started ---
    elif "validation" in completed and "prd" not in completed and "prd" not in running:
        validation_summary = artifact_summaries.get("validation", "")
        lines.append(
            "STAGE: Validation complete, PRD not started yet.\n"
            "- Your first priority is to surface the top 2 risks from the validation results.\n"
            "- If the validation score was low or the go/no-go was ambiguous, push back before suggesting PRD.\n"
            "- Look for assumptions in the validation that were NOT challenged by the agents — surface them now.\n"
            "- If the user is ready to proceed, ask 2 sharp clarifying questions about SCOPE before PRD "
            "(e.g. MVP feature set, must-have vs nice-to-have, monetization model).\n"
            "- Use `suggest_alternatives` if the validation revealed a pivot opportunity worth exploring."
        )
        if validation_summary:
            # Extract any risk signals to include
            lines.append(f"Validation context to draw from:\n{validation_summary[:400]}")

    # --- PRD complete, coding context not started ---
    elif "prd" in completed and "coding_context" not in completed and "coding_context" not in running:
        lines.append(
            "STAGE: PRD done, coding context not started.\n"
            "- This is a critical handoff. Before running coding context, confirm the tech stack.\n"
            "- Use `ask_clarifying_questions` to pin down: preferred language/framework, "
            "solo dev vs team, existing infrastructure, timeline pressure.\n"
            "- Use `compare_approaches` if the PRD implies a choice between two technical directions.\n"
            "- Flag any features in the PRD that look technically risky — ask if they should be deferred to v2."
        )

    # --- Coding context complete, GTM not started ---
    elif "coding_context" in completed and "gtm" not in completed and "gtm" not in running:
        lines.append(
            "STAGE: Coding context done, GTM not started.\n"
            "- Summarize what's been built so far: validated idea + PRD + tech blueprint.\n"
            "- Before GTM, identify the single biggest unknown: distribution channel or positioning.\n"
            "- Use `suggest_alternatives` for distribution — there are usually 3-4 meaningfully different options.\n"
            "- Use `run_quick_research` to check what distribution channels similar products have used successfully."
        )

    # --- All phases complete ---
    elif len(completed) == 5:
        lines.append(
            "STAGE: All phases complete. Full product blueprint exists.\n"
            "- This is a reflection and refinement stage. Don't propose new runs unless the user has changed direction.\n"
            "- Offer to do deep-dives on any specific artifact using `get_phase_results`.\n"
            "- Use `challenge_assumption` periodically — even completed plans have blind spots.\n"
            "- If the user mentions talking to customers or getting early feedback, help them interpret "
            "what that means for the existing plan."
        )

    # --- Something is currently running ---
    elif running:
        lines.append(
            f"STAGE: {', '.join(running)} currently running.\n"
            "- Don't suggest starting any other phases right now.\n"
            "- Use this time to discuss what we should look for in the results.\n"
            "- Ask the user what their biggest open question is for this phase — set expectations."
        )

    # Periodic challenge mode — if there are completed phases, remind LLM to challenge
    if completed and not running:
        lines.append(
            "CHALLENGE MODE: Since phases are complete, you should periodically (not every message, but when relevant) "
            "use `challenge_assumption` to stress-test something from the phase results. "
            "Good candidates: market size estimates, assumed willingness to pay, competitive differentiation claims, "
            "technical complexity estimates."
        )

    return "\n".join(lines)


def _build_system_prompt(project: Project, phases: list[Phase], artifact_summaries: dict[str, str]) -> str:
    completed = [p.phase_type.value for p in phases if p.status in ("completed", "in_review", "accepted")]
    running = [p.phase_type.value for p in phases if p.status in ("queued", "running")]
    failed = [p.phase_type.value for p in phases if p.status == "failed"]
    is_first_message = len(phases) == 0

    next_phase = None
    for pt in PHASE_ORDER:
        if pt.value not in completed and pt.value not in running:
            next_phase = pt.value
            break

    constraints_section = ""
    if project.constraints:
        constraints_lines = "\n".join(f"  - {k}: {v}" for k, v in project.constraints.items())
        constraints_section = f"\nCONFIRMED USER DECISIONS:\n{constraints_lines}\n"

    artifacts_section = ""
    if artifact_summaries:
        parts = []
        for phase_type, summary in artifact_summaries.items():
            parts.append(f"### {PHASE_LABELS.get(PhaseType(phase_type), phase_type)} findings:\n{summary}")
        artifacts_section = "\nCOMPLETED PHASE FINDINGS:\n" + "\n\n".join(parts)

    available_agents_section = "\nAVAILABLE AGENTS PER PHASE:\n"
    for phase_key, agents in PHASE_AGENTS.items():
        available_agents_section += f"  {phase_key}: {', '.join(agents)}\n"

    # Build context-specific proactive instructions based on pipeline state
    proactive_instructions = _build_proactive_instructions(
        project=project,
        completed=completed,
        running=running,
        next_phase=next_phase,
        artifact_summaries=artifact_summaries,
        is_first_message=is_first_message,
    )

    return f"""You are an AI co-founder — a proactive strategic partner helping the user build their product from idea to launch. You don't wait to be asked. You notice things, challenge assumptions, surface risks, and drive the conversation forward.

PROJECT CONTEXT:
- Name: {project.name}
- Idea: {project.raw_idea}
- Domain: {project.domain or 'Not specified'}
- Target Audience: {project.target_audience or 'Not specified'}
{constraints_section}
PIPELINE STATUS:
- Completed: {', '.join(completed) if completed else 'None'}
- Running: {', '.join(running) if running else 'None'}
- Failed: {', '.join(failed) if failed else 'None'}
- Next: {next_phase or 'All phases complete'}

PHASE ORDER: discovery → validation → prd → coding_context → gtm
{artifacts_section}{available_agents_section}
{proactive_instructions}

CORE RULES:

1. **Semantic drift detection**: When the user says something that contradicts CONFIRMED USER DECISIONS or phase findings, flag it and use `propose_targeted_rerun` for affected agents only.

2. **Persist decisions**: When the user confirms any key decision (segment, pricing, stack, budget), call `update_project_constraints` immediately.

3. **Targeted re-runs only**: Never propose a full phase restart when only 1-2 agents' outputs are invalidated.

4. **Before any phase**: Use `ask_clarifying_questions` with 2-3 questions specific to THIS idea — not generic questions.

5. **After phase completion**: Pull key findings with `get_phase_results`, synthesize in 2-3 sentences, then discuss what's most important.

6. **Tone**: Direct and opinionated. Say "I think X because Y." Have a view. Push back when something seems wrong. Use `challenge_assumption` proactively — don't wait for the user to ask.

7. **Research on demand**: Use `run_quick_research` to ground conversations in real data whenever a factual claim is unverified. Don't speculate when you can look it up.

8. **Comparisons**: When the user is deciding between two options, use `compare_approaches` to give a structured verdict, not a neutral "it depends."

9. **Refine from chat**: When a user criticizes specific parts of a phase result (e.g. "the market size is too optimistic", "the personas don't match"), use `submit_feedback_and_refine` to record their feedback and re-run the affected agents. Extract section-level feedback from the conversation rather than asking the user to switch to the phase UI.

NEVER:
- Start a phase without explicit user confirmation
- Be a passive narrator — interpret results, don't just report them
- Give generic advice — every response should reference specifics from THIS project"""


async def _get_project_context(db: AsyncSession, project_id: uuid.UUID) -> tuple[Project, list[Phase]]:
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one()

    phases_result = await db.execute(
        select(Phase).where(Phase.project_id == project_id).order_by(Phase.created_at)
    )
    phases = list(phases_result.scalars().all())

    return project, phases


async def _get_artifact_summaries(db: AsyncSession, project_id: uuid.UUID, phases: list[Phase]) -> dict[str, str]:
    """Load truncated summaries of completed phase artifacts for the system prompt."""
    summaries: dict[str, str] = {}
    completed_phases = [p for p in phases if p.status in ("completed", "in_review", "accepted")]

    for phase in completed_phases:
        art_result = await db.execute(
            select(Artifact)
            .where(Artifact.phase_id == phase.id)
            .order_by(Artifact.created_at)
        )
        artifacts = list(art_result.scalars().all())
        if not artifacts:
            continue

        # Take the final synthesis artifact if available, else all truncated
        parts = []
        for art in artifacts:
            content = art.markdown_content or ""
            # Prioritise synthesis/final artifacts and truncate the rest
            if "synthesizer" in art.agent_name.lower() or "final" in art.agent_name.lower() or "writer" in art.agent_name.lower():
                parts.append(f"**{art.title}** (key output):\n{content[:800]}")
            else:
                parts.append(f"**{art.title}**:\n{content[:300]}")

        summaries[phase.phase_type.value] = "\n\n".join(parts)[:2000]

    return summaries


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
        return f"'{PHASE_LABELS[phase_type]}' is already running. Please wait."

    phase_idx = PHASE_ORDER.index(phase_type)
    if phase_idx > 0:
        prev_type = PHASE_ORDER[phase_idx - 1]
        prev = await db.execute(
            select(Phase).where(
                Phase.project_id == project_id,
                Phase.phase_type == prev_type,
                Phase.status == "accepted",
            )
        )
        if prev.scalars().first() is None:
            return f"Cannot start '{PHASE_LABELS[phase_type]}' yet — '{PHASE_LABELS[prev_type]}' must be accepted first."

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

    await db.commit()
    dispatch_phase_job(phase.id, use_v2=project.use_v2_worker)

    return f"Started '{PHASE_LABELS[phase_type]}'. Agents are now working on your idea."


async def _handle_propose_targeted_rerun(
    db: AsyncSession,
    project_id: uuid.UUID,
    phase_type_str: str,
    agent_names: list[str],
    reason: str,
    invalidated_findings: list[str],
) -> str:
    """Validate the proposed agents exist in the phase and return a proposal payload."""
    valid_agents = PHASE_AGENTS.get(phase_type_str, [])
    invalid = [a for a in agent_names if a not in valid_agents]
    if invalid:
        return f"Unknown agents for phase '{phase_type_str}': {invalid}. Valid agents: {valid_agents}"

    return json.dumps({
        "type": "targeted_rerun_proposal",
        "phase_type": phase_type_str,
        "agent_names": agent_names,
        "reason": reason,
        "invalidated_findings": invalidated_findings,
    })


async def _handle_update_constraints(
    db: AsyncSession, project_id: uuid.UUID, new_constraints: dict[str, str]
) -> str:
    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one()

    existing = dict(project.constraints or {})
    existing.update(new_constraints)
    project.constraints = existing
    await db.commit()

    keys = ", ".join(f"{k}={v}" for k, v in new_constraints.items())
    return f"Saved: {keys}. These will be applied to all future agent runs."


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
        return f"'{PHASE_LABELS[phase_type]}' hasn't been started yet."

    if phase.status in ("queued", "running"):
        return f"'{PHASE_LABELS[phase_type]}' is still running."

    if phase.status == "failed":
        return f"'{PHASE_LABELS[phase_type]}' failed. You can try running it again."

    art_result = await db.execute(
        select(Artifact).where(Artifact.phase_id == phase.id).order_by(Artifact.created_at)
    )
    artifacts = list(art_result.scalars().all())

    if not artifacts:
        return f"'{PHASE_LABELS[phase_type]}' completed but no artifacts were stored."

    summaries = []
    for art in artifacts:
        content = art.markdown_content or json.dumps(art.content) if art.content else "No content"
        if len(content) > 1500:
            content = content[:1500] + "..."
        summaries.append(f"### {art.title}\n{content}")

    return "\n\n---\n\n".join(summaries)


async def _handle_clarifying_questions(context_message: str, questions: list[dict]) -> str:
    return json.dumps({"context_message": context_message, "questions": questions})


def _handle_challenge_assumption(assumption: str, challenge: str, evidence: str, question_to_user: str) -> str:
    """Returns a structured payload — actual streaming to client happens in chat_stream."""
    return json.dumps({
        "type": "challenge_card",
        "assumption": assumption,
        "challenge": challenge,
        "evidence": evidence,
        "question_to_user": question_to_user,
    })


def _handle_suggest_alternatives(
    aspect: str, current_direction: str, alternatives: list[dict], recommendation: str
) -> str:
    return json.dumps({
        "type": "alternatives_card",
        "aspect": aspect,
        "current_direction": current_direction,
        "alternatives": alternatives,
        "recommendation": recommendation,
    })


async def _handle_run_quick_research(query: str, purpose: str) -> str:
    """Run a Tavily search and return a formatted result string for the LLM."""
    if not settings.TAVILY_API_KEY:
        return f"Web search not available (TAVILY_API_KEY not set). Cannot look up: {query}"
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        response = client.search(
            query=query,
            search_depth="basic",
            max_results=5,
            include_answer=True,
        )
        parts: list[str] = [f"Research query: {query}\nPurpose: {purpose}\n"]
        if response.get("answer"):
            parts.append(f"Summary: {response['answer']}\n")
        parts.append("Sources:")
        for i, r in enumerate(response.get("results", [])[:4], 1):
            title = r.get("title", "")
            url = r.get("url", "")
            snippet = r.get("content", "")[:200]
            parts.append(f"{i}. {title} ({url})\n   {snippet}")
        return "\n".join(parts)
    except Exception as e:
        return f"Search failed: {e}. Query was: {query}"


def _handle_compare_approaches(
    option_a: str, option_b: str, criteria: list[dict], verdict: str
) -> str:
    return json.dumps({
        "type": "comparison_card",
        "option_a": option_a,
        "option_b": option_b,
        "criteria": criteria,
        "verdict": verdict,
    })


async def _handle_submit_feedback_and_refine(
    db: AsyncSession,
    project_id: uuid.UUID,
    phase_type_str: str,
    feedback_items: list[dict],
    agent_names: list[str],
) -> str:
    """Record structured feedback from chat and trigger a targeted rerun."""
    phase_type = PhaseType(phase_type_str)

    valid_agents = PHASE_AGENTS.get(phase_type_str, [])
    invalid = [a for a in agent_names if a not in valid_agents]
    if invalid:
        return f"Unknown agents for phase '{phase_type_str}': {invalid}. Valid agents: {valid_agents}"

    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["in_review", "accepted"]),
        ).order_by(Phase.created_at.desc())
    )
    source_phase = result.scalars().first()
    if source_phase is None:
        return f"No reviewable '{PHASE_LABELS[phase_type]}' phase found. Run the phase first."

    feedback_type_map = {
        "thumbs_up": FeedbackType.THUMBS_UP,
        "thumbs_down": FeedbackType.THUMBS_DOWN,
        "comment": FeedbackType.COMMENT,
    }

    for item in feedback_items:
        fb_type = feedback_type_map.get(item.get("feedback_type", "comment"), FeedbackType.COMMENT)
        feedback = PhaseFeedback(
            phase_id=source_phase.id,
            section=item.get("section", "General")[:500],
            feedback_type=fb_type,
            comment=item.get("comment"),
        )
        db.add(feedback)

    await db.flush()

    existing_run = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["queued", "running"]),
        )
    )
    if existing_run.scalars().first() is not None:
        await db.commit()
        return f"Feedback saved. However, '{PHASE_LABELS[phase_type]}' is already running — your feedback will be used in the next run."

    new_phase = Phase(
        project_id=project_id,
        phase_type=phase_type,
        status="queued",
        started_at=datetime.now(timezone.utc),
    )
    db.add(new_phase)

    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one()
    project.current_phase = phase_type.value
    project.status = "active"

    await db.commit()
    await db.refresh(new_phase)

    dispatch_phase_job(new_phase.id, use_v2=project.use_v2_worker, agent_names=agent_names)

    agent_list = ", ".join(agent_names)
    fb_count = len(feedback_items)
    return (
        f"Saved {fb_count} feedback item(s) and started refining '{PHASE_LABELS[phase_type]}'. "
        f"Re-running agents: {agent_list}. Results will be available shortly."
    )


async def chat_stream(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_message: str,
) -> AsyncIterator[str]:
    """Process a user message and stream the AI response.

    The caller is responsible for providing a live DB session that will
    remain open for the entire duration of the stream.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        user_msg = ChatMessage(project_id=project_id, role="user", content=user_message)
        db.add(user_msg)
        await db.commit()
    except Exception:
        logger.exception("Failed to save user message for project %s", project_id)
        yield json.dumps({"type": "error", "content": "Failed to save your message. Please try again."})
        yield json.dumps({"type": "done"})
        return

    try:
        project, phases = await _get_project_context(db, project_id)
        artifact_summaries = await _get_artifact_summaries(db, project_id, phases)
        history = await _get_chat_history(db, project_id, limit=30)
    except Exception:
        logger.exception("Failed to load project context for %s", project_id)
        yield json.dumps({"type": "error", "content": "Failed to load project context. Please refresh and try again."})
        yield json.dumps({"type": "done"})
        return

    system_prompt = _build_system_prompt(project, phases, artifact_summaries)

    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)

    client = _make_openai_client()

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            stream=True,
            temperature=0.7,
            max_tokens=2000,
        )
    except Exception as exc:
        logger.exception("OpenAI API call failed for project %s", project_id)
        yield json.dumps({"type": "error", "content": "AI service is temporarily unavailable. Please try again in a moment."})
        yield json.dumps({"type": "done"})
        return

    full_content = ""
    tool_calls_data: dict[int, dict[str, str]] = {}

    try:
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
                # Send keep-alive while processing tool calls
                yield ": keepalive\n"

                for _idx, tc_data in sorted(tool_calls_data.items()):
                    fn_name = tc_data["name"]
                    try:
                        fn_args = json.loads(tc_data["arguments"])
                    except json.JSONDecodeError:
                        logger.warning("Malformed tool call arguments for %s: %s", fn_name, tc_data["arguments"])
                        fn_args = {}

                    try:
                        fn_result = await _execute_tool_call(db, project_id, fn_name, fn_args, messages, full_content, tc_data, client)
                        if isinstance(fn_result, tuple):
                            fn_result_str, events_to_yield = fn_result
                            for event in events_to_yield:
                                yield event
                            fn_result = fn_result_str
                        else:
                            # fn_result is already a string
                            pass
                    except Exception:
                        logger.exception("Tool call %s failed for project %s", fn_name, project_id)
                        fn_result = f"Tool '{fn_name}' encountered an error. Please try again."

                    followup_messages = messages + [
                        {
                            "role": "assistant",
                            "content": full_content if full_content else "",
                            "tool_calls": [{
                                "id": tc_data["id"],
                                "type": "function",
                                "function": {"name": fn_name, "arguments": tc_data["arguments"]},
                            }],
                        },
                        {"role": "tool", "tool_call_id": tc_data["id"], "content": fn_result},
                    ]

                    try:
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
                    except Exception:
                        logger.exception("Follow-up OpenAI call failed for project %s", project_id)
                        yield json.dumps({"type": "token", "content": "\n\n*I encountered an issue processing the results. Please try again.*"})
                        full_content += "\n\n*I encountered an issue processing the results. Please try again.*"

    except Exception:
        logger.exception("Stream processing error for project %s", project_id)
        if not full_content:
            yield json.dumps({"type": "error", "content": "Connection to AI service was interrupted. Please try again."})

    # Persist the assistant response
    if full_content:
        try:
            assistant_msg = ChatMessage(
                project_id=project_id,
                role="assistant",
                content=full_content,
            )
            db.add(assistant_msg)
            await db.commit()
        except Exception:
            logger.exception("Failed to save assistant response for project %s", project_id)

    yield json.dumps({"type": "done"})


async def _execute_tool_call(
    db: AsyncSession,
    project_id: uuid.UUID,
    fn_name: str,
    fn_args: dict[str, Any],
    messages: list[dict[str, Any]],
    full_content: str,
    tc_data: dict[str, str],
    client: AsyncOpenAI,
) -> str | tuple[str, list[str]]:
    """Execute a single tool call and return (result_string, [events_to_yield]).

    Returns either a plain string or a tuple of (result, events_to_stream).
    """
    events: list[str] = []

    if fn_name == "start_phase":
        events.append(json.dumps({
            "type": "action",
            "action": "phase_started",
            "phase": fn_args["phase_type"],
        }))
        result = await _handle_start_phase(db, project_id, fn_args["phase_type"])
        return result, events

    elif fn_name == "propose_targeted_rerun":
        proposal_payload = await _handle_propose_targeted_rerun(
            db=db,
            project_id=project_id,
            phase_type_str=fn_args["phase_type"],
            agent_names=fn_args["agent_names"],
            reason=fn_args["reason"],
            invalidated_findings=fn_args.get("invalidated_findings", []),
        )
        try:
            parsed = json.loads(proposal_payload)
            if parsed.get("type") == "targeted_rerun_proposal":
                events.append(json.dumps({
                    "type": "targeted_rerun_proposal",
                    "phase_type": parsed["phase_type"],
                    "agent_names": parsed["agent_names"],
                    "reason": parsed["reason"],
                    "invalidated_findings": parsed["invalidated_findings"],
                }))
        except (json.JSONDecodeError, AttributeError):
            pass
        return proposal_payload, events

    elif fn_name == "update_project_constraints":
        result = await _handle_update_constraints(db, project_id, fn_args["constraints"])
        return result

    elif fn_name == "get_phase_results":
        result = await _handle_get_results(db, project_id, fn_args["phase_type"])
        return result

    elif fn_name == "ask_clarifying_questions":
        events.append(json.dumps({
            "type": "questions",
            "context_message": fn_args.get("context_message", ""),
            "questions": fn_args.get("questions", []),
        }))
        result = await _handle_clarifying_questions(
            fn_args.get("context_message", ""),
            fn_args.get("questions", []),
        )
        return result, events

    elif fn_name == "challenge_assumption":
        payload = _handle_challenge_assumption(
            assumption=fn_args["assumption"],
            challenge=fn_args["challenge"],
            evidence=fn_args.get("evidence", ""),
            question_to_user=fn_args["question_to_user"],
        )
        events.append(json.dumps(json.loads(payload)))
        return payload, events

    elif fn_name == "suggest_alternatives":
        payload = _handle_suggest_alternatives(
            aspect=fn_args["aspect"],
            current_direction=fn_args.get("current_direction", ""),
            alternatives=fn_args.get("alternatives", []),
            recommendation=fn_args.get("recommendation", ""),
        )
        events.append(json.dumps(json.loads(payload)))
        return payload, events

    elif fn_name == "run_quick_research":
        events.append(json.dumps({
            "type": "research_start",
            "query": fn_args["query"],
        }))
        result = await _handle_run_quick_research(
            query=fn_args["query"],
            purpose=fn_args.get("purpose", ""),
        )
        return result, events

    elif fn_name == "compare_approaches":
        payload = _handle_compare_approaches(
            option_a=fn_args["option_a"],
            option_b=fn_args["option_b"],
            criteria=fn_args.get("criteria", []),
            verdict=fn_args.get("verdict", ""),
        )
        events.append(json.dumps(json.loads(payload)))
        return payload, events

    elif fn_name == "submit_feedback_and_refine":
        events.append(json.dumps({
            "type": "refine_started",
            "phase": fn_args["phase_type"],
            "agent_names": fn_args.get("agent_names", []),
            "feedback_count": len(fn_args.get("feedback_items", [])),
        }))
        result = await _handle_submit_feedback_and_refine(
            db=db,
            project_id=project_id,
            phase_type_str=fn_args["phase_type"],
            feedback_items=fn_args.get("feedback_items", []),
            agent_names=fn_args.get("agent_names", []),
        )
        return result, events

    return "Unknown function"
