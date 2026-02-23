from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PlanType(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    TEAM = "team"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    PAST_DUE = "past_due"
    EXPIRED = "expired"


PLAN_LIMITS = {
    PlanType.FREE: 1,
    PlanType.PRO: 5,
    PlanType.TEAM: -1,  # unlimited
}


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    plan: Mapped[PlanType] = mapped_column(Enum(PlanType), nullable=False, default=PlanType.FREE)
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.ACTIVE
    )
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    razorpay_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="subscription")
    payments: Mapped[list["PaymentHistory"]] = relationship(back_populates="subscription", cascade="all, delete-orphan")

    @property
    def project_limit(self) -> int:
        return PLAN_LIMITS.get(self.plan, 1)


class PaymentHistory(Base):
    __tablename__ = "payment_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False
    )
    razorpay_payment_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    subscription: Mapped["Subscription"] = relationship(back_populates="payments")
