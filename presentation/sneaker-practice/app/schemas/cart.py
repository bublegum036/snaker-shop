from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field

class Quantity(BaseModel):
    model_config = ConfigDict(extra='forbid')
    quantity: int = Field(gt=0, le=2147483647, strict=True)

class CartAdd(Quantity):
    product_size_id: int = Field(gt=0, le=2147483647, strict=True)

class CartItemRead(BaseModel):
    id: int
    product_size_id: int
    product_id: int
    name: str
    size: Decimal
    price: Decimal
    quantity: int
    stock: int
    subtotal: Decimal

class CartRead(BaseModel):
    items: list[CartItemRead]
    estimated_total: Decimal
