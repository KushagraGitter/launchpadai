from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    raw_idea: str = Field(min_length=10, max_length=10000)
    domain: str | None = Field(default=None, max_length=255)
    target_audience: str | None = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    raw_idea: str | None = Field(default=None, min_length=10, max_length=10000)
    domain: str | None = Field(default=None, max_length=255)
    target_audience: str | None = Field(default=None, max_length=2000)
    use_v2_worker: bool | None = Field(default=None)


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    raw_idea: str
    domain: str | None
    target_audience: str | None
    status: str
    current_phase: str | None
    use_v2_worker: bool
    constraints: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int
