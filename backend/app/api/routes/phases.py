from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import case, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.artifact import Artifact
from app.models.phase import Phase, PhaseType
from app.models.phase_feedback import PhaseFeedback
from app.models.project import Project
from app.models.user import User
from app.schemas.phase import (
    ArtifactResponse,
    PhaseFeedbackCreate,
    PhaseFeedbackResponse,
    PhaseDetailResponse,
    PhaseRefineRequest,
    PhaseResponse,
    PhaseRunRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()

PHASE_ORDER = [PhaseType.DISCOVERY, PhaseType.VALIDATION, PhaseType.PRD, PhaseType.CODING_CONTEXT, PhaseType.GTM]

STUCK_PHASE_TIMEOUT = timedelta(minutes=5)


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


async def _reset_stuck_phases(db: AsyncSession, project_id: uuid.UUID, phase_type: PhaseType) -> int:
    """Mark phases stuck in queued/running for longer than the timeout as failed."""
    cutoff = datetime.now(timezone.utc) - STUCK_PHASE_TIMEOUT
    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["queued", "running"]),
            Phase.started_at < cutoff,
        )
    )
    stuck = result.scalars().all()
    for p in stuck:
        p.status = "failed"
        p.completed_at = datetime.now(timezone.utc)
        logger.warning("Reset stuck phase %s (was %s since %s)", p.id, p.status, p.started_at)
    if stuck:
        await db.flush()
    return len(stuck)


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
                Phase.status == "accepted",
            )
        )
        if result.scalars().first() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Previous phase '{prev_phase_type.value}' must be accepted first",
            )

    await _reset_stuck_phases(db, project_id, body.phase_type)

    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == body.phase_type,
            Phase.status.in_(["queued", "running"]),
        )
    )
    if result.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This phase is already queued or running. If it appears stuck, it will auto-reset after 5 minutes.",
        )

    phase = Phase(
        project_id=project_id,
        phase_type=body.phase_type,
        status="queued",
        started_at=datetime.now(timezone.utc),
    )
    db.add(phase)

    project.current_phase = body.phase_type.value
    project.status = "active"

    # Commit before dispatching so the worker can find the phase record.
    await db.commit()

    from app.worker import dispatch_phase_job
    dispatch_phase_job(phase.id, use_v2=project.use_v2_worker)

    return phase


class TargetedRerunRequest(BaseModel):
    agent_names: list[str]


@router.post("/{project_id}/phases/{phase_type}/rerun-agents", response_model=PhaseResponse, status_code=status.HTTP_202_ACCEPTED)
async def rerun_agents(
    project_id: uuid.UUID,
    phase_type: PhaseType,
    body: TargetedRerunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-run specific agents within a completed/in_review phase without restarting the whole phase."""
    project = await _get_user_project(project_id, current_user.id, db)

    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["completed", "in_review", "accepted"]),
        ).order_by(Phase.created_at.desc())
    )
    if result.scalars().first() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Phase '{phase_type.value}' must be completed or in review before doing a targeted re-run",
        )

    # No other run of this phase currently active
    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["queued", "running"]),
        )
    )
    if result.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A run of this phase is already in progress",
        )

    phase = Phase(
        project_id=project_id,
        phase_type=phase_type,
        status="queued",
        started_at=datetime.now(timezone.utc),
    )
    db.add(phase)
    project.current_phase = phase_type.value
    project.status = "active"
    await db.commit()

    from app.worker import dispatch_phase_job
    dispatch_phase_job(phase.id, use_v2=project.use_v2_worker, agent_names=body.agent_names)

    return phase


@router.post("/{project_id}/phases/{phase_type}/cancel", response_model=PhaseResponse)
async def cancel_phase(
    project_id: uuid.UUID,
    phase_type: PhaseType,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Force-cancel a stuck phase so it can be re-run."""
    await _get_user_project(project_id, current_user.id, db)

    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["queued", "running"]),
        )
    )
    phase = result.scalars().first()
    if phase is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active phase found to cancel",
        )

    phase.status = "failed"
    phase.completed_at = datetime.now(timezone.utc)
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
        .order_by(
            case(
                (Phase.status == "accepted", 0),
                (Phase.status == "in_review", 1),
                (Phase.status == "completed", 2),
                else_=3,
            ),
            Phase.created_at.desc(),
        )
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
        select(Phase)
        .where(Phase.project_id == project_id, Phase.phase_type == phase_type)
        .order_by(
            case(
                (Phase.status == "accepted", 0),
                (Phase.status == "in_review", 1),
                (Phase.status == "completed", 2),
                else_=3,
            ),
            Phase.created_at.desc(),
        )
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


async def _get_latest_reviewable_phase(
    db: AsyncSession, project_id: uuid.UUID, phase_type: PhaseType
) -> Phase:
    """Get the most recent phase in 'in_review' status, or raise 400."""
    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status == "in_review",
        ).order_by(Phase.created_at.desc())
    )
    phase = result.scalars().first()
    if phase is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Phase '{phase_type.value}' is not in review",
        )
    return phase


@router.post(
    "/{project_id}/phases/{phase_type}/feedback",
    response_model=PhaseFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_feedback(
    project_id: uuid.UUID,
    phase_type: PhaseType,
    body: PhaseFeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit feedback on a section of an artifact. Phase must be in_review."""
    await _get_user_project(project_id, current_user.id, db)
    phase = await _get_latest_reviewable_phase(db, project_id, phase_type)

    if body.artifact_id is not None:
        art_result = await db.execute(
            select(Artifact).where(
                Artifact.id == body.artifact_id,
                Artifact.phase_id == phase.id,
            )
        )
        if art_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Artifact not found in this phase",
            )

    feedback = PhaseFeedback(
        phase_id=phase.id,
        artifact_id=body.artifact_id,
        section=body.section,
        feedback_type=body.feedback_type,
        comment=body.comment,
    )
    db.add(feedback)
    await db.flush()
    await db.refresh(feedback)
    return feedback


@router.get(
    "/{project_id}/phases/{phase_type}/feedback",
    response_model=list[PhaseFeedbackResponse],
)
async def list_feedback(
    project_id: uuid.UUID,
    phase_type: PhaseType,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all feedback for the latest in_review or accepted phase run."""
    await _get_user_project(project_id, current_user.id, db)

    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["in_review", "accepted"]),
        ).order_by(Phase.created_at.desc())
    )
    phase = result.scalars().first()
    if phase is None:
        return []

    fb_result = await db.execute(
        select(PhaseFeedback)
        .where(PhaseFeedback.phase_id == phase.id)
        .order_by(PhaseFeedback.created_at)
    )
    return fb_result.scalars().all()


@router.post(
    "/{project_id}/phases/{phase_type}/accept",
    response_model=PhaseResponse,
)
async def accept_phase(
    project_id: uuid.UUID,
    phase_type: PhaseType,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a phase as accepted so the next phase can be started."""
    await _get_user_project(project_id, current_user.id, db)
    phase = await _get_latest_reviewable_phase(db, project_id, phase_type)

    phase.status = "accepted"
    return phase


@router.post(
    "/{project_id}/phases/{phase_type}/refine",
    response_model=PhaseResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def refine_phase(
    project_id: uuid.UUID,
    phase_type: PhaseType,
    body: PhaseRefineRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a targeted rerun incorporating user feedback. Phase must be in_review."""
    project = await _get_user_project(project_id, current_user.id, db)
    await _get_latest_reviewable_phase(db, project_id, phase_type)

    result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == phase_type,
            Phase.status.in_(["queued", "running"]),
        )
    )
    if result.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A run of this phase is already in progress",
        )

    phase = Phase(
        project_id=project_id,
        phase_type=phase_type,
        status="queued",
        started_at=datetime.now(timezone.utc),
    )
    db.add(phase)
    project.current_phase = phase_type.value
    project.status = "active"
    await db.commit()

    from app.worker import dispatch_phase_job
    dispatch_phase_job(phase.id, use_v2=project.use_v2_worker, agent_names=body.agent_names)

    return phase
