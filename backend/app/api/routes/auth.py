from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_user_subscription
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.project import Project
from app.models.subscription import PLAN_LIMITS, PlanType, Subscription, SubscriptionStatus
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter()

INVALID_CREDENTIALS_MSG = "Invalid username or password"


def _build_user_response(user: User, sub: Subscription, project_count: int) -> UserResponse:
    limit = PLAN_LIMITS.get(sub.plan, 1)
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        plan=sub.plan.value,
        project_limit=limit,
        project_count=project_count,
        created_at=user.created_at,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    sub = Subscription(user_id=user.id, plan=PlanType.FREE, status=SubscriptionStatus.ACTIVE)
    db.add(sub)
    await db.flush()
    await db.refresh(sub)

    return _build_user_response(user, sub, 0)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS_MSG,
        )

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(get_user_subscription),
):
    count_result = await db.execute(
        select(func.count()).select_from(Project).where(Project.user_id == current_user.id)
    )
    project_count = count_result.scalar() or 0
    return _build_user_response(current_user, subscription, project_count)
