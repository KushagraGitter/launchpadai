from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.phase import PhaseType
from app.models.phase_feedback import FeedbackType


class PhaseResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    phase_type: PhaseType
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ArtifactResponse(BaseModel):
    id: uuid.UUID
    phase_id: uuid.UUID
    agent_name: str
    artifact_type: str
    title: str
    content: dict | None
    markdown_content: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentRunResponse(BaseModel):
    id: uuid.UUID
    phase_id: uuid.UUID
    crew_name: str
    agent_name: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    token_usage: dict | None
    output_summary: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PhaseRunRequest(BaseModel):
    phase_type: PhaseType


class PhaseDetailResponse(BaseModel):
    phase: PhaseResponse
    artifacts: list[ArtifactResponse]
    agent_runs: list[AgentRunResponse]


class PhaseFeedbackCreate(BaseModel):
    artifact_id: uuid.UUID | None = None
    section: str = Field(min_length=1, max_length=500)
    feedback_type: FeedbackType
    comment: str | None = Field(default=None, max_length=5000)


class PhaseFeedbackResponse(BaseModel):
    id: uuid.UUID
    phase_id: uuid.UUID
    artifact_id: uuid.UUID | None
    section: str
    feedback_type: str
    comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PhaseRefineRequest(BaseModel):
    agent_names: list[str] = Field(min_length=1)
