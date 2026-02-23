from __future__ import annotations

import hashlib
import hmac
import logging

import razorpay

from app.core.config import settings
from app.models.subscription import PlanType

logger = logging.getLogger(__name__)

PLAN_ID_MAP = {
    PlanType.PRO: lambda: settings.RAZORPAY_PLAN_PRO,
    PlanType.TEAM: lambda: settings.RAZORPAY_PLAN_TEAM,
}


def _get_client() -> razorpay.Client:
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def create_customer(name: str, email: str) -> dict:
    client = _get_client()
    return client.customer.create({"name": name, "email": email})


def create_subscription(customer_id: str, plan: PlanType) -> dict:
    plan_id_fn = PLAN_ID_MAP.get(plan)
    if not plan_id_fn:
        raise ValueError(f"No Razorpay plan configured for {plan.value}")
    plan_id = plan_id_fn()
    if not plan_id:
        raise ValueError(f"Razorpay plan ID not set for {plan.value}")

    client = _get_client()
    return client.subscription.create({
        "plan_id": plan_id,
        "customer_id": customer_id,
        "total_count": 120,
        "quantity": 1,
    })


def cancel_subscription(razorpay_subscription_id: str) -> dict:
    client = _get_client()
    return client.subscription.cancel(razorpay_subscription_id, {"cancel_at_cycle_end": 1})


def verify_payment_signature(data: dict) -> bool:
    """Verify Razorpay payment callback signature."""
    client = _get_client()
    try:
        client.utility.verify_payment_signature(data)
        return True
    except razorpay.errors.SignatureVerificationError:
        return False


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verify Razorpay webhook signature using HMAC-SHA256."""
    secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not secret:
        logger.warning("RAZORPAY_WEBHOOK_SECRET not configured")
        return False
    expected = hmac.new(
        secret.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def fetch_subscription(razorpay_subscription_id: str) -> dict:
    client = _get_client()
    return client.subscription.fetch(razorpay_subscription_id)
