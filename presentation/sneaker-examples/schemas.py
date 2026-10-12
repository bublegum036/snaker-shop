"""Учебные схемы. Подключения к базе и авторизации здесь нет."""
from decimal import Decimal
from pydantic import BaseModel, Field


class CartItemCreate(BaseModel):
    product_size_id: int = Field(gt=0)
    quantity: int = Field(gt=0, strict=True)


class UserRead(BaseModel):
    id: int
    email: str


class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)


class ProductRead(ProductCreate):
    id: int
