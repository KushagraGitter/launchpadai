import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str = Field(max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    plan: str = "free"
    project_limit: int = 1
    project_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
