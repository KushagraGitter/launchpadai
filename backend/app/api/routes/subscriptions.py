from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_user_subscription
from app.core.config import settings
from app.core.database import get_db
from app.models.project import Project
from app.models.subscription import (
    PLAN_LIMITS,
    PaymentHistory,
    PlanType,
    Subscription,
    SubscriptionStatus,
)
from app.models.user import User
from app.schemas.subscription import (
    CheckoutRequest,
    CheckoutResponse,
    PaymentHistoryResponse,
    SubscriptionResponse,
    VerifyRequest,
)
from app.services import razorpay_service

router = APIRouter()


@router.get("/current", response_model=SubscriptionResponse)
async def get_current_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(get_user_subscription),
):
    count_result = await db.execute(
        select(func.count()).select_from(Project).where(Project.user_id == current_user.id)
    )
    project_count = count_result.scalar() or 0
    limit = PLAN_LIMITS.get(subscription.plan, 1)

    return SubscriptionResponse(
        id=subscription.id,
        plan=subscription.plan.value,
        status=subscription.status.value,
        project_limit=limit,
        project_count=project_count,
        razorpay_subscription_id=subscription.razorpay_subscription_id,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        cancelled_at=subscription.cancelled_at,
        created_at=subscription.created_at,
    )


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(get_user_subscription),
):
    try:
        target_plan = PlanType(body.plan)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan")

    if target_plan == PlanType.FREE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot checkout free plan")

    if subscription.plan == target_plan and subscription.status == SubscriptionStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already on this plan")

    if not settings.RAZORPAY_KEY_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment system not configured",
        )

    customer_id = subscription.razorpay_customer_id
    if not customer_id:
        customer = razorpay_service.create_customer(current_user.name, current_user.email)
        customer_id = customer["id"]
        subscription.razorpay_customer_id = customer_id

    rz_sub = razorpay_service.create_subscription(customer_id, target_plan)

    return CheckoutResponse(
        subscription_id=str(subscription.id),
        razorpay_key_id=settings.RAZORPAY_KEY_ID,
        razorpay_subscription_id=rz_sub["id"],
    )


@router.post("/verify")
async def verify_payment(
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(get_user_subscription),
):
    is_valid = razorpay_service.verify_payment_signature({
        "razorpay_payment_id": body.razorpay_payment_id,
        "razorpay_subscription_id": body.razorpay_subscription_id,
        "razorpay_signature": body.razorpay_signature,
    })

    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment verification failed")

    rz_sub = razorpay_service.fetch_subscription(body.razorpay_subscription_id)
    plan_id = rz_sub.get("plan_id", "")

    if plan_id == settings.RAZORPAY_PLAN_PRO:
        target_plan = PlanType.PRO
    elif plan_id == settings.RAZORPAY_PLAN_TEAM:
        target_plan = PlanType.TEAM
    else:
        target_plan = PlanType.PRO

    subscription.plan = target_plan
    subscription.status = SubscriptionStatus.ACTIVE
    subscription.razorpay_subscription_id = body.razorpay_subscription_id
    subscription.current_period_start = datetime.now(timezone.utc)
    subscription.cancelled_at = None

    payment = PaymentHistory(
        subscription_id=subscription.id,
        razorpay_payment_id=body.razorpay_payment_id,
        amount_cents=1900 if target_plan == PlanType.PRO else 4900,
        currency="USD",
        status="captured",
    )
    db.add(payment)

    return {"status": "success", "plan": target_plan.value}


@router.post("/cancel")
async def cancel_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(get_user_subscription),
):
    if subscription.plan == PlanType.FREE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already on free plan")

    if subscription.razorpay_subscription_id:
        try:
            razorpay_service.cancel_subscription(subscription.razorpay_subscription_id)
        except Exception:
            pass

    subscription.status = SubscriptionStatus.CANCELLED
    subscription.cancelled_at = datetime.now(timezone.utc)

    return {"status": "cancelled", "message": "Subscription will remain active until the end of the billing period"}


@router.get("/history", response_model=list[PaymentHistoryResponse])
async def get_payment_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(get_user_subscription),
):
    result = await db.execute(
        select(PaymentHistory)
        .where(PaymentHistory.subscription_id == subscription.id)
        .order_by(PaymentHistory.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()
