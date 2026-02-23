from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.subscription import (
    PaymentHistory,
    PlanType,
    Subscription,
    SubscriptionStatus,
)
from app.services import razorpay_service
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/razorpay")
async def razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not razorpay_service.verify_webhook_signature(body, signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    payload = await request.json()
    event = payload.get("event", "")
    entity = payload.get("payload", {})

    async with async_session() as db:
        try:
            if event == "subscription.activated":
                await _handle_subscription_activated(db, entity)
            elif event == "subscription.charged":
                await _handle_subscription_charged(db, entity)
            elif event in ("subscription.cancelled", "subscription.expired"):
                await _handle_subscription_ended(db, entity, event)
            elif event == "payment.failed":
                await _handle_payment_failed(db, entity)
            else:
                logger.info("Unhandled webhook event: %s", event)

            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("Webhook processing error for event: %s", event)
            raise

    return {"status": "ok"}


async def _handle_subscription_activated(db: AsyncSession, entity: dict) -> None:
    sub_data = entity.get("subscription", {}).get("entity", {})
    rz_sub_id = sub_data.get("id")
    if not rz_sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.razorpay_subscription_id == rz_sub_id)
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = SubscriptionStatus.ACTIVE
        sub.current_period_start = datetime.now(timezone.utc)


async def _handle_subscription_charged(db: AsyncSession, entity: dict) -> None:
    payment_data = entity.get("payment", {}).get("entity", {})
    sub_data = entity.get("subscription", {}).get("entity", {})
    rz_sub_id = sub_data.get("id") or payment_data.get("subscription_id")
    payment_id = payment_data.get("id")

    if not rz_sub_id or not payment_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.razorpay_subscription_id == rz_sub_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    sub.status = SubscriptionStatus.ACTIVE
    sub.current_period_start = datetime.now(timezone.utc)

    existing = await db.execute(
        select(PaymentHistory).where(PaymentHistory.razorpay_payment_id == payment_id)
    )
    if existing.scalar_one_or_none() is None:
        payment = PaymentHistory(
            subscription_id=sub.id,
            razorpay_payment_id=payment_id,
            amount_cents=payment_data.get("amount", 0),
            currency=payment_data.get("currency", "USD").upper(),
            status="captured",
        )
        db.add(payment)


async def _handle_subscription_ended(db: AsyncSession, entity: dict, event: str) -> None:
    sub_data = entity.get("subscription", {}).get("entity", {})
    rz_sub_id = sub_data.get("id")
    if not rz_sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.razorpay_subscription_id == rz_sub_id)
    )
    sub = result.scalar_one_or_none()
    if sub:
        if event == "subscription.cancelled":
            sub.status = SubscriptionStatus.CANCELLED
        else:
            sub.status = SubscriptionStatus.EXPIRED
            sub.plan = PlanType.FREE
            sub.razorpay_subscription_id = None


async def _handle_payment_failed(db: AsyncSession, entity: dict) -> None:
    payment_data = entity.get("payment", {}).get("entity", {})
    rz_sub_id = payment_data.get("subscription_id")
    if not rz_sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.razorpay_subscription_id == rz_sub_id)
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = SubscriptionStatus.PAST_DUE
