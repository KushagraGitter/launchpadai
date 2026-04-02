"""
Clerk user sync — upserts a local User record from Clerk identity claims.

Three cases:
1. User already exists by clerk_id → return it
2. User exists by email (pre-Clerk account) → link clerk_id and return
3. Brand new → create User + FREE Subscription
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.subscription import Subscription, PlanType, SubscriptionStatus

logger = logging.getLogger(__name__)


async def get_or_create_user_from_clerk(
    db: AsyncSession,
    clerk_id: str,
    email: str,
    name: str,
) -> User:
    """Look up or create a local User from Clerk identity. Always returns a User."""

    # 1. Try by clerk_id
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()
    if user:
        # Update name/email if changed in Clerk
        changed = False
        if user.email != email.lower():
            user.email = email.lower()
            changed = True
        if user.name != name:
            user.name = name
            changed = True
        if changed:
            await db.flush()
        return user

    # 2. Try by email (existing user migrating to Clerk)
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    if user:
        user.clerk_id = clerk_id
        if name and user.name != name:
            user.name = name
        user.email_verified = True
        await db.flush()
        logger.info("Linked existing user to Clerk", extra={"user_id": str(user.id), "clerk_id": clerk_id})
        return user

    # 3. Brand new user
    user = User(
        id=uuid.uuid4(),
        clerk_id=clerk_id,
        email=email.lower(),
        name=name or email.split("@")[0],
        password_hash=None,
        email_verified=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Create FREE subscription
    sub = Subscription(
        user_id=user.id,
        plan=PlanType.FREE,
        status=SubscriptionStatus.ACTIVE,
    )
    db.add(sub)
    await db.flush()

    logger.info("Created new user from Clerk", extra={"user_id": str(user.id), "clerk_id": clerk_id})
    return user
