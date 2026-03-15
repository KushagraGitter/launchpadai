import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_user_subscription
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.core.config import settings
from app.models.project import Project
from app.models.subscription import PLAN_LIMITS, PlanType, Subscription, SubscriptionStatus
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.email import send_password_reset_email, send_verification_email

router = APIRouter()
logger = logging.getLogger(__name__)

INVALID_CREDENTIALS_MSG = "Invalid username or password"
GENERIC_OK_MSG = "If that email is registered, you will receive an email shortly."


def _build_user_response(user: User, sub: Subscription, project_count: int) -> UserResponse:
    limit = PLAN_LIMITS.get(sub.plan, 1)
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        email_verified=user.email_verified,
        plan=sub.plan.value,
        project_limit=limit,
        project_count=project_count,
        created_at=user.created_at,
    )


async def _set_verification_token(user: User) -> str:
    """Generate and persist an email verification token. Returns the raw token to send."""
    raw_token, hashed = generate_secure_token()
    user.email_verification_token = hashed
    user.email_verification_expires = datetime.now(timezone.utc) + timedelta(
        hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS
    )
    return raw_token


# ──────────────────────────── Registration ────────────────────────────


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
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
        email_verified=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    sub = Subscription(user_id=user.id, plan=PlanType.FREE, status=SubscriptionStatus.ACTIVE)
    db.add(sub)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


# ──────────────────────────── Email Verification ─────────────────────


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    hashed = hash_token(body.token)
    result = await db.execute(
        select(User).where(
            User.email_verification_token == hashed,
            User.email_verified == False,  # noqa: E712
        )
    )
    user = result.scalar_one_or_none()

    if user is None or user.email_verification_expires is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link.")

    if datetime.now(timezone.utc) > user.email_verification_expires:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link has expired. Please request a new one.")

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    await db.commit()

    return MessageResponse(message="Email verified successfully. You can now sign in.")


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    body: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    if user is not None and not user.email_verified:
        raw_token = await _set_verification_token(user)
        await db.commit()
        background_tasks.add_task(send_verification_email, user.email, user.name, raw_token)

    return MessageResponse(message=GENERIC_OK_MSG)


# ──────────────────────────── Login ──────────────────────────────────


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


# ──────────────────────────── Password Reset ─────────────────────────


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    if user is not None:
        raw_token, hashed = generate_secure_token()
        user.password_reset_token = hashed
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(
            hours=settings.PASSWORD_RESET_EXPIRE_HOURS
        )
        await db.commit()
        background_tasks.add_task(send_password_reset_email, user.email, user.name, raw_token)

    return MessageResponse(message=GENERIC_OK_MSG)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    hashed = hash_token(body.token)
    result = await db.execute(
        select(User).where(User.password_reset_token == hashed)
    )
    user = result.scalar_one_or_none()

    if user is None or user.password_reset_expires is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link.")

    if datetime.now(timezone.utc) > user.password_reset_expires:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link has expired. Please request a new one.")

    user.password_hash = hash_password(body.password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.commit()

    return MessageResponse(message="Password reset successfully. You can now sign in with your new password.")


# ──────────────────────────── Token Refresh ──────────────────────────


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


# ──────────────────────────── Current User ───────────────────────────


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
