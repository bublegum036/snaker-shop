"""Insert missing catalog fixtures; never reset stock or existing prices."""
from decimal import Decimal
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from app.models import Brand, Product, ProductSize

FIXTURES = [
    (Brand, [{"id": 1, "name": "North"}, {"id": 2, "name": "City"}]),
    (Product, [
        {"id": 10, "name": "North Runner", "brand_id": 1, "price": Decimal("7990.00")},
        {"id": 20, "name": "City Walk", "brand_id": 2, "price": Decimal("5990.00")},
        {"id": 30, "name": "North Trail", "brand_id": 1, "price": Decimal("9990.00")},
    ]),
    (ProductSize, [
        {"id": 101, "product_id": 10, "size": Decimal("42.0"), "stock": 3},
        {"id": 102, "product_id": 10, "size": Decimal("43.0"), "stock": 0},
        {"id": 201, "product_id": 20, "size": Decimal("41.0"), "stock": 5},
        {"id": 301, "product_id": 30, "size": Decimal("42.0"), "stock": 2},
    ]),
]

def seed(engine):
    with engine.begin() as connection:
        for model, rows in FIXTURES:
            table = model.__table__
            connection.execute(insert(table).values(rows).on_conflict_do_nothing(index_elements=["id"]))
            # Names come only from the fixed models above, not user input.
            seq = connection.scalar(text("SELECT pg_get_serial_sequence(:t, 'id')"), {"t": table.name})
            connection.execute(text(
                f"SELECT setval(:seq, GREATEST(COALESCE((SELECT MAX(id) FROM {table.name}), 1), nextval(:seq)), true)"
            ), {"seq": seq})

if __name__ == "__main__":
    from app.database import engine
    try:
        seed(engine)
        print("Seed complete: 2 brands, 3 products, 4 sizes on a fresh database; existing rows preserved.")
    finally:
        engine.dispose()
