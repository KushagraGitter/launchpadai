from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    role: str
    content: str
    metadata_: dict[str, Any] | None = Field(None, alias="metadata_")
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
    project_name: str
    project_idea: str
