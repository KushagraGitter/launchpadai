"""
API Key management endpoints.

POST   /api/keys       — Create new API key (returns raw key ONCE)
GET    /api/keys       — List all keys (prefix only)
DELETE /api/keys/{id}  — Revoke a key
PATCH  /api/keys/{id}  — Rename a key
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_user_subscription
from app.core.database import get_db
from app.models.api_key import APIKey
from app.models.subscription import API_KEY_LIMITS, RATE_LIMITS, Subscription
from app.models.user import User
from app.api.api_key_auth import generate_api_key

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateKeyRequest(BaseModel):
    name: str


class CreateKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key: str  # Raw key — shown ONCE
    key_prefix: str
    rate_limit_rpm: int
    created_at: datetime


class KeyListItem(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    rate_limit_rpm: int
    is_active: bool
    last_used_at: datetime | None
    expires_at: datetime | None
    created_at: datetime


class KeyListResponse(BaseModel):
    keys: list[KeyListItem]
    total: int
    plan_limit: int


class UpdateKeyRequest(BaseModel):
    name: str | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=CreateKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: CreateKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(get_user_subscription),
):
    """Create a new API key. The raw key is returned ONCE — store it safely."""
    key_limit = API_KEY_LIMITS.get(subscription.plan, 0)
    if key_limit == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API keys not available on your plan. Upgrade to Developer or Team.",
            headers={"X-Upgrade-Required": "true"},
        )

    # Count existing active keys
    count_result = await db.execute(
        select(func.count()).select_from(APIKey).where(
            APIKey.user_id == current_user.id,
            APIKey.is_active == True,
        )
    )
    active_count = count_result.scalar() or 0

    if active_count >= key_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"API key limit reached ({key_limit}). Revoke an existing key or upgrade your plan.",
        )

    rpm = RATE_LIMITS.get(subscription.plan, 100)
    raw_key, key_hash, key_prefix = generate_api_key()

    api_key = APIKey(
        user_id=current_user.id,
        name=body.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        rate_limit_rpm=rpm,
    )
    db.add(api_key)
    await db.flush()
    await db.refresh(api_key)

    return CreateKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key=raw_key,  # Only time this is returned
        key_prefix=key_prefix,
        rate_limit_rpm=rpm,
        created_at=api_key.created_at,
    )


@router.get("", response_model=KeyListResponse)
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(get_user_subscription),
):
    """List all API keys for the current user. Never returns raw keys."""
    result = await db.execute(
        select(APIKey)
        .where(APIKey.user_id == current_user.id)
        .order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()

    return KeyListResponse(
        keys=[
            KeyListItem(
                id=k.id,
                name=k.name,
                key_prefix=k.key_prefix,
                rate_limit_rpm=k.rate_limit_rpm,
                is_active=k.is_active,
                last_used_at=k.last_used_at,
                expires_at=k.expires_at,
                created_at=k.created_at,
            )
            for k in keys
        ],
        total=len(keys),
        plan_limit=API_KEY_LIMITS.get(subscription.plan, 0),
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke (deactivate) an API key. Cannot be undone."""
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    api_key.is_active = False
    await db.flush()


@router.patch("/{key_id}", response_model=KeyListItem)
async def update_api_key(
    key_id: uuid.UUID,
    body: UpdateKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an API key's name."""
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    if body.name is not None:
        api_key.name = body.name
    await db.flush()
    await db.refresh(api_key)

    return KeyListItem(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        rate_limit_rpm=api_key.rate_limit_rpm,
        is_active=api_key.is_active,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
    )
