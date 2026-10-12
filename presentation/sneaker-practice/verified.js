window.SNEAKER_M01 = {
  "counts": {
    "users": 0,
    "brands": 2,
    "products": 3,
    "product_sizes": 4,
    "cart_items": 0,
    "orders": 0,
    "order_items": 0
  },
  "relationship": {
    "product": "North Runner",
    "brand": "North",
    "sizes": [
      "42.0",
      "43.0"
    ]
  },
  "constraints": [
    {
      "case": "negative price",
      "sqlstate": "23514"
    },
    {
      "case": "unknown brand",
      "sqlstate": "23503"
    },
    {
      "case": "null product name",
      "sqlstate": "23502"
    },
    {
      "case": "negative stock",
      "sqlstate": "23514"
    },
    {
      "case": "duplicate product size",
      "sqlstate": "23505"
    },
    {
      "case": "zero cart quantity",
      "sqlstate": "23514"
    },
    {
      "case": "duplicate cart position",
      "sqlstate": "23505"
    },
    {
      "case": "unknown cart owner",
      "sqlstate": "23503"
    },
    {
      "case": "negative order total",
      "sqlstate": "23514"
    },
    {
      "case": "invalid order status",
      "sqlstate": "23514"
    },
    {
      "case": "zero order quantity",
      "sqlstate": "23514"
    },
    {
      "case": "negative snapshot price",
      "sqlstate": "23514"
    }
  ],
  "checks": [
    "new database has no application tables",
    "migration creates seven tables and alembic_version",
    "migration reaches 0001 and repeats safely",
    "alembic check finds no pending model changes",
    "seven foreign keys exist",
    "price is non-null numeric(10,2)",
    "image_url is nullable",
    "catalog seed counts 2 / 3 / 4 and no accounts or purchases",
    "second seed preserves all row values",
    "repeat seed does not reset edited stock",
    "ORM relationships load brand and two sizes",
    "negative price",
    "unknown brand",
    "null product name",
    "negative stock",
    "duplicate product size",
    "zero cart quantity",
    "duplicate cart position",
    "unknown cart owner",
    "negative order total",
    "invalid order status",
    "zero order quantity",
    "negative snapshot price",
    "seed advances identity beyond fixed IDs",
    "constraint fixtures rolled back"
  ],
  "database": "new disposable database",
  "revision": "0001"
};
