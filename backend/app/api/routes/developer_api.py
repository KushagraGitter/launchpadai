"""
Developer API v1 — Programmatic access to LaunchPadAI.

All endpoints accept X-API-Key auth (or Bearer JWT).
Prefixed at /api/v1/ in main.py.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.api_key_auth import get_current_user_flexible
from app.core.config import settings
from app.core.database import get_db
from app.models.artifact import Artifact
from app.models.phase import Phase, PhaseType
from app.models.project import Project
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ValidateIdeaRequest(BaseModel):
    idea: str
    name: str | None = None
    domain: str | None = None
    target_audience: str | None = None


class ValidateIdeaResponse(BaseModel):
    project_id: uuid.UUID
    phase_id: uuid.UUID
    status: str
    message: str


class ProjectSummary(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    current_phase: str | None
    created_at: datetime


class ProjectListResponse(BaseModel):
    projects: list[ProjectSummary]
    total: int


class ArtifactItem(BaseModel):
    id: uuid.UUID
    agent_name: str
    artifact_type: str
    title: str
    content: dict | None
    markdown_content: str | None
    created_at: datetime


class ArtifactListResponse(BaseModel):
    artifacts: list[ArtifactItem]
    project_id: uuid.UUID
    phase: str | None


class ScoreDimension(BaseModel):
    score: float
    rationale: str


class BenchmarkScoreResponse(BaseModel):
    project_id: uuid.UUID
    overall_score: float
    percentile_estimate: int
    verdict: str
    one_line_summary: str
    biggest_strength: str
    biggest_risk: str
    dimensions: dict[str, ScoreDimension]


class PhaseStatusResponse(BaseModel):
    phase_id: uuid.UUID
    phase_type: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_user_project(
    project_id: uuid.UUID, user: User, db: AsyncSession
) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/validate", response_model=ValidateIdeaResponse, status_code=status.HTTP_202_ACCEPTED)
async def validate_idea(
    body: ValidateIdeaRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    """
    Submit an idea for validation. Creates a project, runs Discovery + Validation.
    Returns immediately with project_id — poll /projects/{id}/phases for status.
    """
    project_name = body.name or body.idea[:80]

    project = Project(
        user_id=current_user.id,
        name=project_name,
        raw_idea=body.idea,
        domain=body.domain,
        target_audience=body.target_audience,
        status="active",
        use_v2_worker=True,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)

    # Create and enqueue discovery phase
    phase = Phase(
        project_id=project.id,
        phase_type=PhaseType.DISCOVERY,
        status="queued",
        started_at=datetime.now(timezone.utc),
    )
    db.add(phase)
    await db.flush()
    await db.refresh(phase)

    # Push job to Redis queue for v2 worker
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        job_payload = json.dumps({"phase_id": str(phase.id)})
        await r.rpush("ideaos:phase_jobs_v2", job_payload)
    finally:
        await r.aclose()

    return ValidateIdeaResponse(
        project_id=project.id,
        phase_id=phase.id,
        status="queued",
        message="Discovery phase queued. Poll GET /api/v1/projects/{project_id}/phases for status.",
    )


@router.get("/projects", response_model=ProjectListResponse)
async def list_projects(
    limit: int = 20,
    skip: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    """List all projects for the authenticated user."""
    result = await db.execute(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    projects = result.scalars().all()

    return ProjectListResponse(
        projects=[
            ProjectSummary(
                id=p.id,
                name=p.name,
                status=p.status,
                current_phase=p.current_phase,
                created_at=p.created_at,
            )
            for p in projects
        ],
        total=len(projects),
    )


@router.get("/projects/{project_id}/phases", response_model=list[PhaseStatusResponse])
async def get_project_phases(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    """Get status of all phases for a project."""
    project = await _get_user_project(project_id, current_user, db)

    result = await db.execute(
        select(Phase)
        .where(Phase.project_id == project.id)
        .order_by(Phase.created_at.asc())
    )
    phases = result.scalars().all()

    return [
        PhaseStatusResponse(
            phase_id=p.id,
            phase_type=p.phase_type.value,
            status=p.status,
            started_at=p.started_at,
            completed_at=p.completed_at,
        )
        for p in phases
    ]


@router.get("/projects/{project_id}/score", response_model=BenchmarkScoreResponse)
async def get_benchmark_score(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    """Get benchmark score for a project. Requires validation phase to be complete."""
    project = await _get_user_project(project_id, current_user, db)

    # Find validation phase
    phase_result = await db.execute(
        select(Phase)
        .where(Phase.project_id == project.id, Phase.phase_type == PhaseType.VALIDATION)
        .order_by(Phase.created_at.desc())
        .limit(1)
    )
    phase = phase_result.scalar_one_or_none()
    if not phase:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Validation not run yet")

    # Find benchmark score artifact
    artifact_result = await db.execute(
        select(Artifact)
        .where(Artifact.phase_id == phase.id, Artifact.agent_name == "Benchmark Scorer")
        .limit(1)
    )
    artifact = artifact_result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Benchmark score not available")

    raw: dict = artifact.content if isinstance(artifact.content, dict) else {}
    dims = raw.get("dimensions", {})

    dimensions = {}
    for key, val in dims.items():
        if isinstance(val, dict) and "score" in val:
            dimensions[key] = ScoreDimension(
                score=float(val.get("score", 0)),
                rationale=str(val.get("rationale", "")),
            )

    return BenchmarkScoreResponse(
        project_id=project.id,
        overall_score=float(raw.get("overall_score", 0)),
        percentile_estimate=int(raw.get("percentile_estimate", 0)),
        verdict=str(raw.get("verdict", "")),
        one_line_summary=str(raw.get("one_line_summary", "")),
        biggest_strength=str(raw.get("biggest_strength", "")),
        biggest_risk=str(raw.get("biggest_risk", "")),
        dimensions=dimensions,
    )


@router.get("/projects/{project_id}/artifacts", response_model=ArtifactListResponse)
async def get_project_artifacts(
    project_id: uuid.UUID,
    phase: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    """Get all artifacts for a project, optionally filtered by phase type."""
    project = await _get_user_project(project_id, current_user, db)

    query = select(Artifact).join(Phase).where(Phase.project_id == project.id)
    if phase:
        try:
            phase_type = PhaseType(phase.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid phase: {phase}")
        query = query.where(Phase.phase_type == phase_type)

    query = query.order_by(Artifact.created_at.asc())
    result = await db.execute(query)
    artifacts = result.scalars().all()

    return ArtifactListResponse(
        artifacts=[
            ArtifactItem(
                id=a.id,
                agent_name=a.agent_name,
                artifact_type=a.artifact_type,
                title=a.title,
                content=a.content if isinstance(a.content, dict) else None,
                markdown_content=a.markdown_content,
                created_at=a.created_at,
            )
            for a in artifacts
        ],
        project_id=project.id,
        phase=phase,
    )


@router.post("/projects/{project_id}/run-phase", response_model=ValidateIdeaResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_phase(
    project_id: uuid.UUID,
    phase_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    """Trigger a specific phase for an existing project."""
    project = await _get_user_project(project_id, current_user, db)

    try:
        pt = PhaseType(phase_type.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid phase type: {phase_type}")

    phase = Phase(
        project_id=project.id,
        phase_type=pt,
        status="queued",
        started_at=datetime.now(timezone.utc),
    )
    db.add(phase)
    await db.flush()
    await db.refresh(phase)

    r = aioredis.from_url(settings.REDIS_URL)
    try:
        job_payload = json.dumps({"phase_id": str(phase.id)})
        await r.rpush("ideaos:phase_jobs_v2", job_payload)
    finally:
        await r.aclose()

    return ValidateIdeaResponse(
        project_id=project.id,
        phase_id=phase.id,
        status="queued",
        message=f"{phase_type} phase queued.",
    )
