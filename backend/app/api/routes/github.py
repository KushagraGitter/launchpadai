"""
GitHub integration routes:
  POST   /api/integrations/github/connect     — save PAT + verify
  GET    /api/integrations/github/status       — connection status
  DELETE /api/integrations/github/disconnect   — remove token
  GET    /api/integrations/github/repos        — list repos (push access)
  POST   /api/projects/{project_id}/export/github — export tasks → issues
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.artifact import Artifact
from app.models.github_integration import GitHubIntegration
from app.models.phase import Phase, PhaseType
from app.models.project import Project
from app.models.user import User
from app.services import github_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class GitHubConnectRequest(BaseModel):
    token: str


class GitHubStatusResponse(BaseModel):
    connected: bool
    github_username: str | None = None
    default_repo: str | None = None
    connected_at: str | None = None


class GitHubRepoResponse(BaseModel):
    full_name: str
    name: str
    private: bool
    description: str | None = None
    html_url: str = ""


class GitHubExportRequest(BaseModel):
    repo: str  # "owner/repo"


class GitHubIssueResponse(BaseModel):
    number: int
    html_url: str
    title: str


class GitHubExportResponse(BaseModel):
    repo: str
    issues_created: int
    issues: list[GitHubIssueResponse]
    errors: list[str]


class SetDefaultRepoRequest(BaseModel):
    repo: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/integrations/github/connect", response_model=GitHubStatusResponse)
async def connect_github(
    body: GitHubConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save and verify a GitHub Personal Access Token."""
    # Verify the token works
    try:
        gh_user = await github_service.verify_token(body.token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to reach GitHub API")

    # Upsert integration
    result = await db.execute(
        select(GitHubIntegration).where(GitHubIntegration.user_id == current_user.id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.github_token = body.token
        existing.github_username = gh_user.login
        existing.is_active = True
    else:
        integration = GitHubIntegration(
            user_id=current_user.id,
            github_username=gh_user.login,
            github_token=body.token,
        )
        db.add(integration)

    await db.flush()

    return GitHubStatusResponse(
        connected=True,
        github_username=gh_user.login,
        default_repo=existing.default_repo if existing else None,
        connected_at=str(existing.connected_at if existing else "now"),
    )


@router.get("/integrations/github/status", response_model=GitHubStatusResponse)
async def github_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if user has a connected GitHub account."""
    result = await db.execute(
        select(GitHubIntegration).where(
            GitHubIntegration.user_id == current_user.id,
            GitHubIntegration.is_active == True,  # noqa: E712
        )
    )
    integration = result.scalar_one_or_none()

    if not integration:
        return GitHubStatusResponse(connected=False)

    return GitHubStatusResponse(
        connected=True,
        github_username=integration.github_username,
        default_repo=integration.default_repo,
        connected_at=str(integration.connected_at),
    )


@router.delete("/integrations/github/disconnect")
async def disconnect_github(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove GitHub integration."""
    result = await db.execute(
        select(GitHubIntegration).where(GitHubIntegration.user_id == current_user.id)
    )
    integration = result.scalar_one_or_none()
    if integration:
        await db.delete(integration)
        await db.flush()
    return {"status": "disconnected"}


@router.put("/integrations/github/default-repo", response_model=GitHubStatusResponse)
async def set_default_repo(
    body: SetDefaultRepoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set the default repo for GitHub exports."""
    result = await db.execute(
        select(GitHubIntegration).where(
            GitHubIntegration.user_id == current_user.id,
            GitHubIntegration.is_active == True,  # noqa: E712
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GitHub not connected")

    integration.default_repo = body.repo
    await db.flush()

    return GitHubStatusResponse(
        connected=True,
        github_username=integration.github_username,
        default_repo=integration.default_repo,
        connected_at=str(integration.connected_at),
    )


@router.get("/integrations/github/repos", response_model=list[GitHubRepoResponse])
async def list_github_repos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List repos the user has push access to."""
    result = await db.execute(
        select(GitHubIntegration).where(
            GitHubIntegration.user_id == current_user.id,
            GitHubIntegration.is_active == True,  # noqa: E712
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GitHub not connected")

    try:
        repos = await github_service.list_repos(integration.github_token)
    except Exception as e:
        logger.error("Failed to list GitHub repos", exc_info=e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch repos from GitHub")

    return [
        GitHubRepoResponse(
            full_name=r.full_name,
            name=r.name,
            private=r.private,
            description=r.description,
            html_url=r.html_url,
        )
        for r in repos
    ]


@router.post("/{project_id}/export/github", response_model=GitHubExportResponse)
async def export_to_github(
    project_id: uuid.UUID,
    body: GitHubExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export coding_context tasks as GitHub issues.
    Parses the Task Decomposer artifact, creates issues with labels + milestone.
    """
    # Verify project ownership
    proj_result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Get GitHub integration
    gh_result = await db.execute(
        select(GitHubIntegration).where(
            GitHubIntegration.user_id == current_user.id,
            GitHubIntegration.is_active == True,  # noqa: E712
        )
    )
    integration = gh_result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitHub not connected. Connect in Settings first.")

    # Find the coding_context phase
    phase_result = await db.execute(
        select(Phase).where(
            Phase.project_id == project_id,
            Phase.phase_type == PhaseType.CODING_CONTEXT,
        ).order_by(Phase.created_at.desc()).limit(1)
    )
    phase = phase_result.scalar_one_or_none()
    if not phase:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coding Context phase has not been run for this project. Run it first to generate tasks.",
        )

    # Find the Task Decomposer artifact
    art_result = await db.execute(
        select(Artifact).where(
            Artifact.phase_id == phase.id,
            Artifact.agent_name.ilike("%task%decompos%"),
        ).order_by(Artifact.created_at.desc()).limit(1)
    )
    artifact = art_result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task Decomposer artifact not found. Ensure the Coding Context phase has completed.",
        )

    # Parse tasks from artifact
    markdown = artifact.markdown_content or ""
    tasks = github_service.parse_tasks_from_markdown(markdown)

    if not tasks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not parse any tasks from the Task Decomposer output. The artifact may be in an unexpected format.",
        )

    # Export to GitHub
    try:
        export_result = await github_service.export_tasks_as_issues(
            token=integration.github_token,
            repo=body.repo,
            project_name=project.name,
            tasks=tasks,
        )
    except Exception as e:
        logger.error("GitHub export failed", exc_info=e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub API error: {str(e)}")

    return GitHubExportResponse(
        repo=export_result.repo,
        issues_created=export_result.issues_created,
        issues=[
            GitHubIssueResponse(number=i.number, html_url=i.html_url, title=i.title)
            for i in export_result.issues
        ],
        errors=export_result.errors,
    )
