"""
Landing page routes:
  GET  /api/projects/{id}/landing-page          — get landing page info + lead stats
  GET  /api/projects/{id}/landing-page/leads     — list leads
  GET  /api/landing/{slug}                       — serve the public landing page HTML
  POST /api/landing/{slug}/lead                  — capture a lead (public, no auth)
  PUT  /api/projects/{id}/landing-page/publish   — toggle publish status
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.landing_page import LandingPage, LandingPageLead
from app.models.project import Project
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class LandingPageInfoResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    slug: str
    is_published: bool
    page_title: str
    view_count: int
    lead_count: int
    conversion_rate: float
    public_url: str
    template_style: str
    created_at: str


class LeadResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    source: str
    created_at: str


class LeadCaptureRequest(BaseModel):
    email: EmailStr
    name: str | None = None


class LeadCaptureResponse(BaseModel):
    success: bool
    message: str


class PublishToggleRequest(BaseModel):
    is_published: bool


# ── Authenticated routes (project owner) ───────────────────────────────────────

@router.get("/projects/{project_id}/landing-page", response_model=LandingPageInfoResponse)
async def get_landing_page_info(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get landing page info + stats for a project."""
    proj = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(LandingPage).where(LandingPage.project_id == project_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not generated yet. Run the Landing Page phase first.")

    lead_count_result = await db.execute(
        select(func.count()).select_from(LandingPageLead).where(LandingPageLead.landing_page_id == page.id)
    )
    lead_count = lead_count_result.scalar() or 0
    conversion = (lead_count / max(page.view_count, 1)) * 100

    return LandingPageInfoResponse(
        id=page.id,
        project_id=project_id,
        slug=page.slug,
        is_published=page.is_published,
        page_title=page.page_title,
        view_count=page.view_count,
        lead_count=lead_count,
        conversion_rate=round(conversion, 1),
        public_url=f"/landing/{page.slug}",
        template_style=page.template_style,
        created_at=str(page.created_at),
    )


@router.get("/projects/{project_id}/landing-page/leads", response_model=list[LeadResponse])
async def list_leads(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all captured leads for a project's landing page."""
    proj = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(LandingPageLead)
        .where(LandingPageLead.project_id == project_id)
        .order_by(LandingPageLead.created_at.desc())
    )
    leads = result.scalars().all()

    return [
        LeadResponse(
            id=lead.id,
            email=lead.email,
            name=lead.name,
            source=lead.source,
            created_at=str(lead.created_at),
        )
        for lead in leads
    ]


@router.put("/projects/{project_id}/landing-page/publish", response_model=LandingPageInfoResponse)
async def toggle_publish(
    project_id: uuid.UUID,
    body: PublishToggleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle landing page publish status."""
    proj = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(LandingPage).where(LandingPage.project_id == project_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")

    page.is_published = body.is_published
    await db.flush()

    lead_count_result = await db.execute(
        select(func.count()).select_from(LandingPageLead).where(LandingPageLead.landing_page_id == page.id)
    )
    lead_count = lead_count_result.scalar() or 0
    conversion = (lead_count / max(page.view_count, 1)) * 100

    return LandingPageInfoResponse(
        id=page.id,
        project_id=project_id,
        slug=page.slug,
        is_published=page.is_published,
        page_title=page.page_title,
        view_count=page.view_count,
        lead_count=lead_count,
        conversion_rate=round(conversion, 1),
        public_url=f"/landing/{page.slug}",
        template_style=page.template_style,
        created_at=str(page.created_at),
    )


# ── Public routes (no auth) ───────────────────────────────────────────────────

@router.get("/landing/{slug}", response_class=HTMLResponse)
async def serve_landing_page(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Serve the public landing page. Increments view count."""
    result = await db.execute(
        select(LandingPage).where(LandingPage.slug == slug)
    )
    page = result.scalar_one_or_none()

    if not page or not page.is_published:
        return HTMLResponse(
            content="<html><body style='font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#fff'><h1>Page not found</h1></body></html>",
            status_code=404,
        )

    # Increment view count
    await db.execute(
        update(LandingPage).where(LandingPage.id == page.id).values(view_count=LandingPage.view_count + 1)
    )
    await db.commit()

    return HTMLResponse(content=page.html, status_code=200)


@router.post("/landing/{slug}/lead", response_model=LeadCaptureResponse)
async def capture_lead(
    slug: str,
    body: LeadCaptureRequest,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — capture a lead from the landing page."""
    result = await db.execute(
        select(LandingPage).where(LandingPage.slug == slug, LandingPage.is_published == True)  # noqa: E712
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")

    # Check for duplicate email
    existing = await db.execute(
        select(LandingPageLead).where(
            LandingPageLead.landing_page_id == page.id,
            LandingPageLead.email == body.email,
        )
    )
    if existing.scalar_one_or_none():
        return LeadCaptureResponse(success=True, message="You're already on the list!")

    lead = LandingPageLead(
        landing_page_id=page.id,
        project_id=page.project_id,
        email=body.email,
        name=body.name,
        source="landing_page",
    )
    db.add(lead)
    await db.commit()

    return LeadCaptureResponse(success=True, message="You're on the waitlist! We'll be in touch soon.")
