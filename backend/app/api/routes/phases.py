from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.artifact import Artifact
from app.models.phase import Phase, PhaseType
from app.models.project import Project
from app.models.user import User
from app.schemas.phase import (
    ArtifactResponse,
    PhaseDetailResponse,
    PhaseResponse,
    PhaseRunRequest,
)

router = APIRouter()

PHASE_ORDER = [PhaseType.VALIDATION, PhaseType.PRD, PhaseType.CODING_CONTEXT, PhaseType.GTM]


async def _get_user_project(
    project_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("/{project_id}/phases/run", response_model=PhaseResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_phase(
    project_id: uuid.UUID,
    body: PhaseRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_user_project(project_id, current_user.id, db)

    phase_idx = PHASE_ORDER.index(body.phase_type)
    if phase_idx > 0:
        prev_phase_type = PHASE_ORDER[phase_idx - 1]
        result = await db.execute(
            select(Phase).where(
                Phase.project_id == project_id,
                Phase.phase_type == prev_phase_type,
                Phase.status == "completed",
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Previous phase '{prev_phase_type.value}' must be completed first",
            )

    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == body.phase_type,
            Phase.status.in_(["queued", "running"]),
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This phase is already queued or running",
        )

    phase = Phase(
        project_id=project_id,
        phase_type=body.phase_type,
        status="queued",
        started_at=datetime.now(timezone.utc),
    )
    db.add(phase)
    await db.flush()
    await db.refresh(phase)

    project.current_phase = body.phase_type.value
    project.status = "active"

    from app.worker import dispatch_phase_job
    dispatch_phase_job(phase.id)

    return phase


@router.get("/{project_id}/phases", response_model=list[PhaseResponse])
async def list_phases(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_user_project(project_id, current_user.id, db)

    result = await db.execute(
        select(Phase).where(Phase.project_id == project_id).order_by(Phase.created_at)
    )
    return result.scalars().all()


@router.get("/{project_id}/phases/{phase_type}", response_model=PhaseDetailResponse)
async def get_phase_detail(
    project_id: uuid.UUID,
    phase_type: PhaseType,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_user_project(project_id, current_user.id, db)

    result = await db.execute(
        select(Phase)
        .where(Phase.project_id == project_id, Phase.phase_type == phase_type)
        .options(selectinload(Phase.artifacts), selectinload(Phase.agent_runs))
        .order_by(Phase.created_at.desc())
    )
    phase = result.scalars().first()
    if phase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")

    return PhaseDetailResponse(
        phase=phase,
        artifacts=phase.artifacts,
        agent_runs=phase.agent_runs,
    )


@router.get("/{project_id}/phases/{phase_type}/artifacts", response_model=list[ArtifactResponse])
async def list_artifacts(
    project_id: uuid.UUID,
    phase_type: PhaseType,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_user_project(project_id, current_user.id, db)

    result = await db.execute(
        select(Phase).where(Phase.project_id == project_id, Phase.phase_type == phase_type)
    )
    phase = result.scalars().first()
    if phase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")

    art_result = await db.execute(
        select(Artifact).where(Artifact.phase_id == phase.id).order_by(Artifact.created_at)
    )
    return art_result.scalars().all()


@router.patch("/{project_id}/artifacts/{artifact_id}", response_model=ArtifactResponse)
async def update_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an artifact's markdown_content (user edits)."""
    await _get_user_project(project_id, current_user.id, db)

    result = await db.execute(select(Artifact).where(Artifact.id == artifact_id))
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    if "markdown_content" in body:
        artifact.markdown_content = body["markdown_content"]
    if "title" in body:
        artifact.title = body["title"]

    return artifact
