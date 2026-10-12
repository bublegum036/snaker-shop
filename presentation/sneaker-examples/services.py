"""Статический учебный каталог, не ORM и не база данных."""
from decimal import Decimal


def list_products():
    return [
        {"id": 10, "name": "North Runner", "price": Decimal("7990.00")},
        {"id": 20, "name": "City Walk", "price": Decimal("5990.00")},
    ]
