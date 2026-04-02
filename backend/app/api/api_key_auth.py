"""
API Key authentication + rate limiting.

Supports two auth modes:
  1. JWT Bearer token  — Authorization: Bearer <jwt>
  2. API Key            — X-API-Key: lpai_<key>

Rate limiting uses Redis sliding window counters.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.api_key import APIKey
from app.models.subscription import RATE_LIMITS, PlanType, Subscription, SubscriptionStatus
from app.models.user import User

security_scheme = HTTPBearer(auto_error=False)

API_KEY_PREFIX = "lpai_"
API_KEY_RANDOM_BYTES = 32  # 32 bytes = 43 chars in urlsafe base64


# ── Key generation helpers ────────────────────────────────────────────────────

def generate_api_key() -> tuple[str, str, str]:
    """
    Returns (raw_key, key_hash, key_prefix).
    raw_key is shown ONCE to the user, key_hash is stored, key_prefix is for display.
    """
    random_part = secrets.token_urlsafe(API_KEY_RANDOM_BYTES)
    raw_key = f"{API_KEY_PREFIX}{random_part}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = f"{raw_key[:12]}...{raw_key[-4:]}"
    return raw_key, key_hash, key_prefix


def hash_api_key(raw_key: str) -> str:
    """Hash an incoming API key for lookup."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


# ── Rate limiting ─────────────────────────────────────────────────────────────

async def check_rate_limit(user_id: str, rpm_limit: int, request: Request) -> None:
    """
    Sliding-window rate limiter using Redis.
    Key: ratelimit:{user_id}:{minute_bucket}
    """
    if rpm_limit <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API access not available on your plan. Upgrade to Developer or Team.",
        )

    import redis.asyncio as aioredis
    r = aioredis.from_url(settings.REDIS_URL)

    try:
        now = datetime.now(timezone.utc)
        minute_bucket = now.strftime("%Y%m%d%H%M")
        key = f"ratelimit:{user_id}:{minute_bucket}"

        current = await r.incr(key)
        if current == 1:
            await r.expire(key, 120)  # TTL = 2 minutes (covers current + buffer)

        if current > rpm_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Your plan allows {rpm_limit} requests/minute.",
                headers={"Retry-After": "60", "X-RateLimit-Limit": str(rpm_limit)},
            )
    finally:
        await r.aclose()


# ── Auth dependency: flexible JWT or API Key ──────────────────────────────────

async def get_user_by_api_key(
    request: Request,
    db: AsyncSession,
) -> tuple[User, int]:
    """
    Authenticate via X-API-Key header.
    Returns (user, rate_limit_rpm).
    """
    raw_key = request.headers.get("X-API-Key") or request.headers.get("x-api-key")
    if not raw_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")

    if not raw_key.startswith(API_KEY_PREFIX):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key format")

    key_hash = hash_api_key(raw_key)

    result = await db.execute(
        select(APIKey).where(APIKey.key_hash == key_hash, APIKey.is_active == True)
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked API key")

    # Check expiry
    if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key expired")

    # Update last_used_at (non-blocking, fire-and-forget)
    await db.execute(
        update(APIKey).where(APIKey.id == api_key.id).values(last_used_at=datetime.now(timezone.utc))
    )
    await db.commit()

    # Fetch user
    user_result = await db.execute(select(User).where(User.id == api_key.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key owner not found")

    return user, api_key.rate_limit_rpm


async def get_current_user_flexible(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Accepts EITHER Bearer JWT OR X-API-Key.
    For API key auth, also enforces rate limiting.
    """
    # Try API key first (X-API-Key header)
    api_key_header = request.headers.get("X-API-Key") or request.headers.get("x-api-key")

    if api_key_header:
        user, rpm_limit = await get_user_by_api_key(request, db)
        await check_rate_limit(str(user.id), rpm_limit, request)
        return user

    # Fall back to JWT Bearer (Clerk first, then legacy)
    if credentials:
        token = credentials.credentials

        # Try Clerk JWT first
        from app.core.clerk import verify_clerk_token
        from app.services.clerk_sync import get_or_create_user_from_clerk

        clerk_payload = verify_clerk_token(token)
        if clerk_payload:
            clerk_id = clerk_payload.get("sub")
            if clerk_id:
                email = clerk_payload.get("email", clerk_payload.get("email_addresses", [{}])[0].get("email_address", ""))
                name = clerk_payload.get("name", "")
                if not name:
                    first = clerk_payload.get("first_name", "")
                    last = clerk_payload.get("last_name", "")
                    name = f"{first} {last}".strip() or email.split("@")[0]
                user = await get_or_create_user_from_clerk(db, clerk_id, email, name)
                await db.commit()
                return user

        # Legacy JWT fallback
        from app.core.security import decode_token

        payload = decode_token(token)
        if payload is None or payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        try:
            uid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        result = await db.execute(select(User).where(User.id == uid))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication. Provide Bearer token or X-API-Key header.",
    )
