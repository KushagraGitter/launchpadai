"""Phase execution service: orchestrates CrewAI crews, stores artifacts, and generates embeddings."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import PhaseCallbackHandler, parse_agent_output
from app.agents.coding_context.crew import create_coding_context_crew
from app.agents.gtm.crew import create_gtm_crew
from app.agents.prd.crew import create_prd_crew
from app.agents.validation.crew import create_validation_crew
from app.models.agent_run import AgentRun
from app.models.artifact import Artifact
from app.models.phase import Phase, PhaseType
from app.models.project import Project
from app.rag.embeddings import chunk_artifact, generate_embeddings
from app.rag.retriever import get_phase_context, store_embeddings

CREW_FACTORIES = {
    PhaseType.VALIDATION: create_validation_crew,
    PhaseType.PRD: create_prd_crew,
    PhaseType.CODING_CONTEXT: create_coding_context_crew,
    PhaseType.GTM: create_gtm_crew,
}

PHASE_AGENT_NAMES = {
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
    PhaseType.VALIDATION: [],
    PhaseType.PRD: ["validation"],
    PhaseType.CODING_CONTEXT: ["validation", "prd"],
    PhaseType.GTM: ["validation", "prd", "coding_context"],
}


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

        for i, name in enumerate(agent_names):
            agent_runs[i].status = "running"
            agent_runs[i].started_at = datetime.now(timezone.utc)
            await db.flush()
            callback.on_agent_start(name, task_descriptions[i] if i < len(task_descriptions) else "")

        crew_result = crew.kickoff()

        for i, run in enumerate(agent_runs):
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

        phase.status = "completed"
        phase.completed_at = datetime.now(timezone.utc)
        callback.on_phase_complete(phase.phase_type.value)

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
