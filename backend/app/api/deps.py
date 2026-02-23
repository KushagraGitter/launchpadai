from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.project import Project
from app.models.subscription import Subscription, PlanType, PLAN_LIMITS, SubscriptionStatus

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    return user


async def get_user_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Subscription:
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        sub = Subscription(user_id=current_user.id, plan=PlanType.FREE, status=SubscriptionStatus.ACTIVE)
        db.add(sub)
        await db.flush()
        await db.refresh(sub)
    return sub


async def enforce_project_limit(
    subscription: Subscription = Depends(get_user_subscription),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    limit = PLAN_LIMITS.get(subscription.plan, 1)
    if limit == -1:
        return

    count_result = await db.execute(
        select(func.count()).select_from(Project).where(Project.user_id == current_user.id)
    )
    project_count = count_result.scalar() or 0

    if project_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project limit reached. Upgrade your plan.",
            headers={"X-Upgrade-Required": "true"},
        )
