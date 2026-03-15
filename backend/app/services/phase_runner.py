"""Phase execution service: orchestrates CrewAI crews, stores artifacts, and generates embeddings."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crewai import Crew, Process

from app.agents.base import PhaseCallbackHandler, parse_agent_output
from app.agents.coding_context.crew import create_coding_context_crew
from app.agents.discovery.crew import create_discovery_crew
from app.agents.gtm.crew import create_gtm_crew
from app.agents.prd.crew import create_prd_crew
from app.agents.validation.crew import create_validation_crew
from app.models.agent_run import AgentRun
from app.models.artifact import Artifact
from app.models.phase import Phase, PhaseType
from app.models.phase_feedback import PhaseFeedback
from app.models.project import Project
from app.rag.embeddings import chunk_artifact, generate_embeddings
from app.rag.retriever import get_phase_context, store_embeddings

CREW_FACTORIES = {
    PhaseType.DISCOVERY: create_discovery_crew,
    PhaseType.VALIDATION: create_validation_crew,
    PhaseType.PRD: create_prd_crew,
    PhaseType.CODING_CONTEXT: create_coding_context_crew,
    PhaseType.GTM: create_gtm_crew,
}

PHASE_AGENT_NAMES = {
    PhaseType.DISCOVERY: [
        "Problem Explorer",
        "Assumption Challenger",
        "Opportunity Mapper",
        "Brief Builder",
    ],
    PhaseType.VALIDATION: [
        "Market Research Analyst",
        "Technical Feasibility Analyst",
        "User Persona Researcher",
        "Validation Synthesizer",
    ],
    PhaseType.PRD: [
        "Requirements Analyst",
        "Feature Prioritizer",
        "UX Flow Designer",
        "PRD Writer",
    ],
    PhaseType.CODING_CONTEXT: [
        "System Architect",
        "Schema Designer",
        "Task Decomposer",
        "Context Packager",
    ],
    PhaseType.GTM: [
        "Positioning Strategist",
        "Channel Strategist",
        "Marketing Content Creator",
        "Launch Planner",
    ],
}

PHASE_TASK_DESCRIPTIONS = {
    PhaseType.DISCOVERY: [
        "Exploring the real problem space and writing the Problem Statement",
        "Surfacing and stress-testing the riskiest assumptions",
        "Mapping the competitive landscape and defining success criteria",
        "Synthesising all findings into the Project Brief",
    ],
    PhaseType.VALIDATION: [
        "Researching market size, trends, and competitor landscape",
        "Evaluating technical feasibility and stack requirements",
        "Building detailed user personas and pain points",
        "Synthesizing findings into a validation scorecard",
    ],
    PhaseType.PRD: [
        "Gathering and analyzing product requirements",
        "Prioritizing features using MoSCoW framework",
        "Designing user experience flows and wireframes",
        "Writing the comprehensive product requirements document",
    ],
    PhaseType.CODING_CONTEXT: [
        "Designing system architecture and component diagram",
        "Creating database schema and API contracts",
        "Decomposing work into actionable development tasks",
        "Packaging coding context for IDE integration",
    ],
    PhaseType.GTM: [
        "Crafting positioning strategy and value propositions",
        "Identifying optimal marketing and distribution channels",
        "Creating marketing content and messaging frameworks",
        "Building a detailed launch timeline and action plan",
    ],
}

PRIOR_PHASES = {
    PhaseType.DISCOVERY: [],
    PhaseType.VALIDATION: ["discovery"],
    PhaseType.PRD: ["discovery", "validation"],
    PhaseType.CODING_CONTEXT: ["discovery", "validation", "prd"],
    PhaseType.GTM: ["discovery", "validation", "prd", "coding_context"],
}


async def _get_prior_artifact_outputs(
    db: AsyncSession,
    project_id: uuid.UUID,
    phase_type: PhaseType,
    agent_names: list[str],
) -> dict[str, str]:
    """
    Fetch existing artifact content for the given agents in the most recent
    completed/in_review/accepted phase run.  Returns {agent_name: markdown_content}.
    """
    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["completed", "in_review", "accepted"]),
        ).order_by(Phase.created_at.desc())
    )
    prior_phase = result.scalars().first()
    if prior_phase is None:
        return {}

    art_result = await db.execute(
        select(Artifact).where(
            Artifact.phase_id == prior_phase.id,
            Artifact.agent_name.in_(agent_names),
        )
    )
    return {art.agent_name: art.markdown_content or "" for art in art_result.scalars().all()}


async def _get_phase_feedback(
    db: AsyncSession,
    project_id: uuid.UUID,
    phase_type: PhaseType,
) -> list[PhaseFeedback]:
    """Fetch user feedback from the most recent in_review phase run."""
    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["in_review", "accepted"]),
        ).order_by(Phase.created_at.desc())
    )
    source_phase = result.scalars().first()
    if source_phase is None:
        return []

    fb_result = await db.execute(
        select(PhaseFeedback).where(
            PhaseFeedback.phase_id == source_phase.id,
        ).order_by(PhaseFeedback.created_at)
    )
    return list(fb_result.scalars().all())


def _format_feedback_context(feedback_items: list[PhaseFeedback]) -> str:
    """Format user feedback into a context string for agents."""
    if not feedback_items:
        return ""
    parts: list[str] = ["=== USER FEEDBACK ON PREVIOUS DRAFT ==="]
    for fb in feedback_items:
        line = f"- [{fb.feedback_type.value.upper()}] Section: \"{fb.section}\""
        if fb.comment:
            line += f" — Comment: {fb.comment}"
        parts.append(line)
    parts.append("=== END USER FEEDBACK ===")
    parts.append("Please address the user's feedback above, especially sections marked THUMBS_DOWN or with comments.")
    return "\n".join(parts)


async def run_phase_targeted(
    db: AsyncSession,
    phase_id: uuid.UUID,
    target_agent_names: list[str],
) -> None:
    """
    Execute only the specified agents within a phase, injecting prior outputs from
    skipped agents as context. This enables surgical re-runs when a user changes a
    specific constraint without invalidating the entire phase.
    """
    result = await db.execute(select(Phase).where(Phase.id == phase_id))
    phase = result.scalar_one_or_none()
    if phase is None:
        return

    proj_result = await db.execute(select(Project).where(Project.id == phase.project_id))
    project = proj_result.scalar_one()

    callback = PhaseCallbackHandler(phase_id, project.id)
    all_agent_names = PHASE_AGENT_NAMES[phase.phase_type]
    skipped_agents = [n for n in all_agent_names if n not in target_agent_names]

    phase.status = "running"
    phase.started_at = datetime.now(timezone.utc)
    await db.flush()

    callback.on_phase_start(phase.phase_type.value, target_agent_names)

    try:
        prior = PRIOR_PHASES.get(phase.phase_type, [])
        rag_context = ""
        if prior:
            rag_context = await get_phase_context(
                db=db,
                project_id=project.id,
                query=project.raw_idea,
                prior_phases=prior,
            )

        # Fetch prior outputs for skipped agents to inject as context
        prior_outputs = await _get_prior_artifact_outputs(
            db, project.id, phase.phase_type, skipped_agents
        )

        # Build enriched context: project data + prior skipped-agent outputs
        skipped_context_parts = []
        for agent_name in skipped_agents:
            output = prior_outputs.get(agent_name, "")
            if output:
                skipped_context_parts.append(f"--- {agent_name} (prior output, not re-run) ---\n{output[:1000]}")

        # Collect user feedback from the prior review cycle
        feedback_items = await _get_phase_feedback(db, project.id, phase.phase_type)
        user_feedback = _format_feedback_context(feedback_items)

        project_data: dict[str, Any] = {
            "name": project.name,
            "raw_idea": project.raw_idea,
            "domain": project.domain,
            "target_audience": project.target_audience,
            "rag_context": rag_context,
            "constraints": project.constraints or {},
            "prior_agent_outputs": "\n\n".join(skipped_context_parts),
            "user_feedback": user_feedback,
        }

        factory = CREW_FACTORIES[phase.phase_type]
        crew = factory(project_data)

        # Filter crew tasks to only the target agents
        target_tasks = [
            task for task in crew.tasks
            if task.agent and task.agent.role in target_agent_names
        ]

        if not target_tasks:
            callback.on_phase_error(phase.phase_type.value, "No matching tasks found for target agents")
            phase.status = "failed"
            await db.flush()
            return

        # Rebuild a minimal crew with only target tasks
        targeted_crew = Crew(
            agents=[task.agent for task in target_tasks],
            tasks=target_tasks,
            process=Process.sequential,
            verbose=True,
        )

        agent_runs: list[AgentRun] = []
        for name in target_agent_names:
            run = AgentRun(
                phase_id=phase_id,
                crew_name=phase.phase_type.value,
                agent_name=name,
                status="queued",
            )
            db.add(run)
            agent_runs.append(run)
        await db.flush()

        if agent_runs:
            agent_runs[0].status = "running"
            agent_runs[0].started_at = datetime.now(timezone.utc)
            await db.flush()
            callback.on_agent_start(target_agent_names[0], "")

        _current_idx = [0]

        def _on_task_complete(task_output):
            idx = _current_idx[0]
            summary = str(task_output)[:500] if task_output else ""
            if idx < len(agent_runs):
                agent_runs[idx].status = "completed"
                agent_runs[idx].completed_at = datetime.now(timezone.utc)
                agent_runs[idx].output_summary = summary
                callback.on_agent_complete(target_agent_names[idx], summary)
            next_idx = idx + 1
            _current_idx[0] = next_idx
            if next_idx < len(target_agent_names):
                agent_runs[next_idx].status = "running"
                agent_runs[next_idx].started_at = datetime.now(timezone.utc)
                callback.on_agent_start(target_agent_names[next_idx], "")

        targeted_crew.task_callback = _on_task_complete

        crew_result = targeted_crew.kickoff()

        for i, run in enumerate(agent_runs):
            if run.status != "completed":
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc)
                callback.on_agent_complete(target_agent_names[i], "")
        await db.flush()

        await _store_crew_artifacts(
            db=db,
            phase=phase,
            project_id=project.id,
            crew_result=crew_result,
            agent_names=target_agent_names,
        )

        phase.status = "in_review"
        phase.completed_at = datetime.now(timezone.utc)
        callback.on_phase_in_review(phase.phase_type.value)

    except Exception as e:
        callback.on_phase_error(phase.phase_type.value, str(e))
        await db.rollback()

        phase_update = await db.execute(select(Phase).where(Phase.id == phase_id))
        phase = phase_update.scalar_one()
        phase.status = "failed"
        phase.completed_at = datetime.now(timezone.utc)

        error_run = AgentRun(
            phase_id=phase_id,
            crew_name=phase.phase_type.value,
            agent_name="system",
            status="failed",
            output_summary=str(e)[:500],
            completed_at=datetime.now(timezone.utc),
        )
        db.add(error_run)
        await db.flush()


async def run_phase(db: AsyncSession, phase_id: uuid.UUID) -> None:
    """Execute a phase's CrewAI crew and persist results."""
    result = await db.execute(select(Phase).where(Phase.id == phase_id))
    phase = result.scalar_one_or_none()
    if phase is None:
        return

    proj_result = await db.execute(select(Project).where(Project.id == phase.project_id))
    project = proj_result.scalar_one()

    callback = PhaseCallbackHandler(phase_id, project.id)
    agent_names = PHASE_AGENT_NAMES[phase.phase_type]
    task_descriptions = PHASE_TASK_DESCRIPTIONS.get(phase.phase_type, [""] * len(agent_names))

    phase.status = "running"
    phase.started_at = datetime.now(timezone.utc)
    await db.flush()

    callback.on_phase_start(phase.phase_type.value, agent_names)

    try:
        prior = PRIOR_PHASES.get(phase.phase_type, [])
        rag_context = ""
        if prior:
            rag_context = await get_phase_context(
                db=db,
                project_id=project.id,
                query=project.raw_idea,
                prior_phases=prior,
            )

        project_data: dict[str, Any] = {
            "name": project.name,
            "raw_idea": project.raw_idea,
            "domain": project.domain,
            "target_audience": project.target_audience,
            "rag_context": rag_context,
            "constraints": project.constraints or {},
        }

        factory = CREW_FACTORIES[phase.phase_type]
        crew = factory(project_data)

        agent_runs: list[AgentRun] = []
        for name in agent_names:
            run = AgentRun(
                phase_id=phase_id,
                crew_name=phase.phase_type.value,
                agent_name=name,
                status="queued",
            )
            db.add(run)
            agent_runs.append(run)
        await db.flush()

        # Signal the first agent as actively running before kickoff.
        # CrewAI runs agents sequentially via crew.kickoff(), so we
        # emit start for agent 0 only; the step callback will handle the rest.
        agent_runs[0].status = "running"
        agent_runs[0].started_at = datetime.now(timezone.utc)
        await db.flush()
        callback.on_agent_start(agent_names[0], task_descriptions[0] if task_descriptions else "")

        # Install a step callback so we can track per-agent progress
        # as CrewAI processes each task sequentially.
        _current_agent_idx = [0]

        original_task_callback = getattr(crew, '_task_callback', None)

        def _on_task_complete(task_output):
            idx = _current_agent_idx[0]
            summary = str(task_output)[:500] if task_output else ""

            if idx < len(agent_runs):
                agent_runs[idx].status = "completed"
                agent_runs[idx].completed_at = datetime.now(timezone.utc)
                agent_runs[idx].output_summary = summary
                callback.on_agent_complete(agent_names[idx], summary)

            next_idx = idx + 1
            _current_agent_idx[0] = next_idx

            if next_idx < len(agent_names):
                agent_runs[next_idx].status = "running"
                agent_runs[next_idx].started_at = datetime.now(timezone.utc)
                callback.on_agent_start(
                    agent_names[next_idx],
                    task_descriptions[next_idx] if next_idx < len(task_descriptions) else "",
                )

            if original_task_callback:
                original_task_callback(task_output)

        crew.task_callback = _on_task_complete

        crew_result = crew.kickoff()

        # Mark any remaining agents as completed (safety net)
        for i, run in enumerate(agent_runs):
            if run.status != "completed":
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc)
                summary = ""
                if hasattr(crew_result, "tasks_output") and i < len(crew_result.tasks_output):
                    task_output = crew_result.tasks_output[i]
                    summary = str(task_output)[:500] if task_output else ""
                    run.output_summary = summary
                callback.on_agent_complete(agent_names[i], summary)
        await db.flush()

        await _store_crew_artifacts(
            db=db,
            phase=phase,
            project_id=project.id,
            crew_result=crew_result,
            agent_names=agent_names,
        )

        phase.status = "in_review"
        phase.completed_at = datetime.now(timezone.utc)
        callback.on_phase_in_review(phase.phase_type.value)

    except Exception as e:
        callback.on_phase_error(phase.phase_type.value, str(e))
        await db.rollback()

        phase_update = await db.execute(select(Phase).where(Phase.id == phase_id))
        phase = phase_update.scalar_one()
        phase.status = "failed"
        phase.completed_at = datetime.now(timezone.utc)

        error_run = AgentRun(
            phase_id=phase_id,
            crew_name=phase.phase_type.value,
            agent_name="system",
            status="failed",
            output_summary=str(e)[:500],
            completed_at=datetime.now(timezone.utc),
        )
        db.add(error_run)
        await db.flush()


def _strip_code_fences(text: str) -> str:
    """Remove wrapping ```markdown ... ``` fences that agents add around their output."""
    s = text.strip()
    m = re.match(r"^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n\s*```$", s)
    if m:
        return m.group(1).strip()
    return s


async def _store_crew_artifacts(
    db: AsyncSession,
    phase: Phase,
    project_id: uuid.UUID,
    crew_result: Any,
    agent_names: list[str],
) -> None:
    """Extract task outputs from crew result, store as artifacts, and generate embeddings."""
    task_outputs = []
    if hasattr(crew_result, "tasks_output"):
        task_outputs = crew_result.tasks_output
    elif isinstance(crew_result, str):
        task_outputs = [crew_result]

    for i, output in enumerate(task_outputs):
        output_str = str(output) if output else ""
        agent_name = agent_names[i] if i < len(agent_names) else f"agent_{i}"

        artifact = Artifact(
            phase_id=phase.id,
            agent_name=agent_name,
            artifact_type=f"{phase.phase_type.value}_report",
            title=f"{agent_name} Output",
            content=parse_agent_output(output_str),
            markdown_content=_strip_code_fences(output_str),
        )
        db.add(artifact)
        await db.flush()
        await db.refresh(artifact)

        if output_str:
            chunks = chunk_artifact(
                title=artifact.title,
                content=output_str,
                metadata={
                    "phase": phase.phase_type.value,
                    "agent": agent_name,
                },
            )
            if chunks:
                texts = [c["text"] for c in chunks]
                vectors = generate_embeddings(texts)
                await store_embeddings(
                    db=db,
                    artifact_id=artifact.id,
                    project_id=project_id,
                    phase_type=phase.phase_type.value,
                    chunks=chunks,
                    vectors=vectors,
                )

    if hasattr(crew_result, "raw") and crew_result.raw:
        final_artifact = Artifact(
            phase_id=phase.id,
            agent_name="crew_final",
            artifact_type=f"{phase.phase_type.value}_final",
            title=f"{phase.phase_type.value.replace('_', ' ').title()} - Final Output",
            content=parse_agent_output(str(crew_result.raw)),
            markdown_content=_strip_code_fences(str(crew_result.raw)),
        )
        db.add(final_artifact)
        await db.flush()
