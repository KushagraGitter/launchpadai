from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    plan: str
    status: str
    project_limit: int
    project_count: int
    razorpay_subscription_id: str | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CheckoutRequest(BaseModel):
    plan: str


class CheckoutResponse(BaseModel):
    subscription_id: str
    razorpay_key_id: str
    razorpay_subscription_id: str


class VerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


class PaymentHistoryResponse(BaseModel):
    id: uuid.UUID
    razorpay_payment_id: str
    amount_cents: int
    currency: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
