"""Chat endpoints for conversational AI co-founder interaction."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.chat_message import ChatMessage
from app.models.project import Project
from app.models.user import User
from app.schemas.chat import ChatHistoryResponse, ChatMessageResponse, ChatRequest
from app.services.chat_orchestrator import chat_stream

router = APIRouter()


async def _verify_project_access(
    project_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("/{project_id}/chat")
async def send_chat_message(
    project_id: uuid.UUID,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a message and receive a streamed AI response via SSE."""
    await _verify_project_access(project_id, current_user.id, db)

    async def event_stream():
        async for chunk in chat_stream(db, project_id, body.message):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{project_id}/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get chat message history for a project."""
    project = await _verify_project_access(project_id, current_user.id, db)

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()

    return ChatHistoryResponse(
        messages=[ChatMessageResponse.model_validate(m) for m in messages],
        project_name=project.name,
        project_idea=project.raw_idea,
    )
