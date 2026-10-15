from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict

OrderStatus = Literal['created', 'processing', 'completed']

class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: OrderStatus

class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_size_id: int
    quantity: int
    price_at_purchase: Decimal
    name_at_purchase: str | None = None
    size_at_purchase: Decimal | None = None

class OrderRead(BaseModel):
    id: int
    user_id: int
    status: str
    total: Decimal
    created_at: datetime
    items: list[OrderItemRead]
