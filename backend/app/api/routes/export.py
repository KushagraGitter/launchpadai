"""Export endpoints for downloading artifacts in various formats."""

import io
import json
import uuid
import zipfile

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.artifact import Artifact
from app.models.phase import Phase
from app.models.project import Project
from app.models.user import User

router = APIRouter()


@router.get("/{project_id}/export/{phase_type}")
async def export_phase_artifacts(
    project_id: uuid.UUID,
    phase_type: str,
    format: str = "zip",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export all artifacts for a phase as a zip bundle or individual markdown."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    result = await db.execute(
        select(Phase)
        .where(Phase.project_id == project_id, Phase.phase_type == phase_type)
        .options(selectinload(Phase.artifacts))
    )
    phase = result.scalars().first()
    if phase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")

    artifacts = phase.artifacts
    if not artifacts:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No artifacts to export")

    if format == "json":
        data = [
            {
                "title": a.title,
                "agent": a.agent_name,
                "type": a.artifact_type,
                "content": a.content,
                "markdown": a.markdown_content,
            }
            for a in artifacts
        ]
        return data

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for artifact in artifacts:
            safe_name = artifact.agent_name.replace(" ", "_").lower()
            if artifact.markdown_content:
                zf.writestr(f"{safe_name}.md", artifact.markdown_content)
            if artifact.content:
                zf.writestr(f"{safe_name}.json", json.dumps(artifact.content, indent=2))

    buf.seek(0)
    filename = f"{phase_type}_artifacts.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
