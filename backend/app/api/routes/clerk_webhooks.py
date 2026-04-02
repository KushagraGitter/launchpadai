"""
Clerk webhook handler.

Receives user.created, user.updated, user.deleted events from Clerk
and syncs them to the local users table.

Webhook signature is verified using svix.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.services.clerk_sync import get_or_create_user_from_clerk

logger = logging.getLogger(__name__)

router = APIRouter()


def _verify_webhook(request_headers: dict, body: bytes) -> dict:
    """Verify Clerk webhook signature using svix and return parsed payload."""
    from svix.webhooks import Webhook

    if not settings.CLERK_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="CLERK_WEBHOOK_SECRET not configured")

    wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
    try:
        payload = wh.verify(body, request_headers)
        return payload
    except Exception as e:
        logger.warning("Clerk webhook verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook signature")


def _extract_primary_email(data: dict) -> str:
    """Extract the primary email from Clerk user data."""
    email_addresses = data.get("email_addresses", [])
    primary_email_id = data.get("primary_email_address_id")
    for ea in email_addresses:
        if ea.get("id") == primary_email_id:
            return ea.get("email_address", "")
    # Fallback to first email
    if email_addresses:
        return email_addresses[0].get("email_address", "")
    return ""


def _extract_name(data: dict) -> str:
    """Extract user name from Clerk user data."""
    first = data.get("first_name", "") or ""
    last = data.get("last_name", "") or ""
    name = f"{first} {last}".strip()
    return name or "User"


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Clerk webhook events."""
    body = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    payload = _verify_webhook(headers, body)

    event_type = payload.get("type", "")
    data = payload.get("data", {})
    clerk_id = data.get("id", "")

    logger.info("Clerk webhook received", extra={"event": event_type, "clerk_id": clerk_id})

    if event_type == "user.created":
        email = _extract_primary_email(data)
        name = _extract_name(data)
        if email:
            await get_or_create_user_from_clerk(db, clerk_id, email, name)
            await db.commit()
            logger.info("User synced from Clerk webhook", extra={"clerk_id": clerk_id})

    elif event_type == "user.updated":
        email = _extract_primary_email(data)
        name = _extract_name(data)

        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        user = result.scalar_one_or_none()
        if user:
            if email and user.email != email.lower():
                user.email = email.lower()
            if name and user.name != name:
                user.name = name
            await db.commit()
            logger.info("User updated from Clerk webhook", extra={"clerk_id": clerk_id})

    elif event_type == "user.deleted":
        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        user = result.scalar_one_or_none()
        if user:
            logger.info("User deleted in Clerk (no local action)", extra={"clerk_id": clerk_id, "user_id": str(user.id)})
            # Note: We log but don't delete. Implement soft-delete or cascade if needed.

    return {"status": "ok"}
