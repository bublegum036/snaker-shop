"""Committed checkout responses; keys are scoped to one user and operation."""
from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class CheckoutRequestRecord(Base):
    __tablename__ = 'checkout_requests'
    __table_args__ = (
        UniqueConstraint('user_id', 'key', name='uq_checkout_request_user_key'),
        CheckConstraint("key ~ '^[A-Za-z0-9._:-]{1,128}$'", name='ck_checkout_request_key'),
    )
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    key: Mapped[str] = mapped_column(String(128))
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id'))
    response: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
