window.SNEAKER_FINAL = {
  "environment": {
    "os": "Darwin",
    "python": "3.13.15",
    "source": "temporary copy without existing .env or .venv",
    "database": "new empty PostgreSQL database on existing lesson server",
    "swagger": "HTTP /docs and OpenAPI checked; manual UI run is separate"
  },
  "stages": [
    {
      "stage": "new venv",
      "passed": true,
      "seconds": 1.02
    },
    {
      "stage": "install pinned requirements",
      "passed": true,
      "seconds": 7.97
    },
    {
      "stage": "pip check",
      "passed": true,
      "seconds": 0.11
    },
    {
      "stage": "generate local JWT key",
      "passed": true,
      "seconds": 0.03
    },
    {
      "stage": "migrate empty database",
      "passed": true,
      "seconds": 3.71
    },
    {
      "stage": "seed catalog",
      "passed": true,
      "seconds": 0.19
    },
    {
      "stage": "final API acceptance",
      "passed": true,
      "seconds": 4.28
    },
    {
      "stage": "M2-M3 regression",
      "passed": true,
      "seconds": 4.08
    },
    {
      "stage": "M4-M5 regression",
      "passed": true,
      "seconds": 6.78
    }
  ],
  "checks": [
    "migration created seven application tables",
    "migration head is 0001",
    "seed counts are 2/3/4",
    "second seed leaves all data unchanged",
    "final health probes database",
    "docs HTML served",
    "all 21 operations match extended API map",
    "protected checkout advertises Bearer security",
    "anya register",
    "anya login",
    "boris register",
    "boris login",
    "admin register",
    "admin login",
    "admin promotion works through documented CLI",
    "current user from JWT",
    "brands and product list",
    "product detail price",
    "admin create product",
    "admin update product",
    "admin delete unreferenced product",
    "add cart item",
    "set absolute cart quantity",
    "delete cart item",
    "add checkout position 101",
    "add checkout position 201",
    "two-position cart total",
    "no_token status and no writes",
    "not_admin status and no writes",
    "foreign_cart status and no writes",
    "quantity_zero status and no writes",
    "negative_price status and no writes",
    "empty_email status and no writes",
    "validation response omits submitted secrets",
    "short_second_item status and no writes",
    "checkout created",
    "checkout total and price snapshots",
    "checkout cleared own cart",
    "checkout stock 1 and 4",
    "own history and detail",
    "foreign_order status and no writes",
    "status_forbidden status and no writes",
    "admin status operation",
    "inventory: all writes advertise Bearer security",
    "inventory: new product has no sizes",
    "inventory: create size",
    "inventory: size visible in public product",
    "inventory: anonymous cannot POST",
    "inventory: anonymous cannot PATCH",
    "inventory: anonymous cannot DELETE",
    "inventory: ordinary cannot POST",
    "inventory: ordinary cannot PATCH",
    "inventory: ordinary cannot DELETE",
    "inventory: invalid create {'size': '0', 'stock': 1}",
    "inventory: invalid create {'size': '42.01', 'stock': 1}",
    "inventory: invalid create {'size': '1000', 'stock': 1}",
    "inventory: invalid create {'size': 'NaN', 'stock': 1}",
    "inventory: invalid create {'size': 'Infinity', 'stock': 1}",
    "inventory: invalid create {'size': '43', 'stock': -1}",
    "inventory: invalid create {'size': '43', 'stock': 2147483648}",
    "inventory: invalid create {'size': '43', 'stock': True}",
    "inventory: invalid create {'size': '43', 'stock': '2'}",
    "inventory: invalid create {'size': '43', 'stock': 1, 'product_id': 10}",
    "inventory: invalid patch {}",
    "inventory: invalid patch {'stock': None}",
    "inventory: invalid patch {'size': None}",
    "inventory: invalid patch {'stock': -1}",
    "inventory: invalid patch {'stock': True}",
    "inventory: invalid patch {'stock': 1.5}",
    "inventory: invalid patch {'stock': 2147483648}",
    "inventory: invalid patch {'size': '42.01'}",
    "inventory: invalid patch {'size': 'NaN'}",
    "inventory: invalid patch {'product_id': 10}",
    "inventory: duplicate numeric size",
    "inventory: unknown parent",
    "inventory: unknown size",
    "inventory: size cannot be patched under another product",
    "inventory: size cannot be deleted under another product",
    "inventory: rename unused size preserves stock",
    "inventory: create sold-out size",
    "inventory: patch duplicate size rolls back stock too",
    "inventory: delete unused size has empty 204",
    "inventory: delete missing size",
    "inventory: new size can be added to cart",
    "inventory: cart reference prevents rename",
    "inventory: cart reference prevents delete",
    "inventory: stock may fall below cart quantity",
    "inventory: checkout rechecks changed inventory",
    "inventory: absolute restock preserves size",
    "inventory: purchase newly created inventory",
    "inventory: purchase decrements new size once",
    "inventory: history prevents rename",
    "inventory: history prevents deletion",
    "inventory: unchanged size and restock allowed with history",
    "inventory: restock preserves order snapshot",
    "inventory: duplicate create race produces one 201 and one 409",
    "inventory: duplicate race inserted one row",
    "inventory: race buyer has one pair in cart",
    "inventory: stock edit and checkout share observed row locks",
    "inventory: failed concurrent purchase preserves cart and creates no order"
  ],
  "operation_count": 21,
  "operations": {
    "catalog": [
      {
        "method": "GET",
        "path": "/products"
      },
      {
        "method": "GET",
        "path": "/products/{product_id}"
      },
      {
        "method": "POST",
        "path": "/products"
      },
      {
        "method": "PUT",
        "path": "/products/{product_id}"
      },
      {
        "method": "DELETE",
        "path": "/products/{product_id}"
      },
      {
        "method": "GET",
        "path": "/brands"
      }
    ],
    "inventory": [
      {
        "method": "POST",
        "path": "/products/{product_id}/sizes"
      },
      {
        "method": "PATCH",
        "path": "/products/{product_id}/sizes/{size_id}"
      },
      {
        "method": "DELETE",
        "path": "/products/{product_id}/sizes/{size_id}"
      }
    ],
    "auth": [
      {
        "method": "POST",
        "path": "/auth/register"
      },
      {
        "method": "POST",
        "path": "/auth/login"
      },
      {
        "method": "GET",
        "path": "/auth/me"
      }
    ],
    "cart": [
      {
        "method": "GET",
        "path": "/cart"
      },
      {
        "method": "POST",
        "path": "/cart/items"
      },
      {
        "method": "PATCH",
        "path": "/cart/items/{item_id}"
      },
      {
        "method": "DELETE",
        "path": "/cart/items/{item_id}"
      }
    ],
    "orders": [
      {
        "method": "POST",
        "path": "/orders"
      },
      {
        "method": "GET",
        "path": "/orders"
      },
      {
        "method": "GET",
        "path": "/orders/{order_id}"
      },
      {
        "method": "PATCH",
        "path": "/orders/{order_id}/status"
      }
    ],
    "health": [
      {
        "method": "GET",
        "path": "/health"
      }
    ]
  },
  "errors": [
    {
      "key": "no_token",
      "status": 401,
      "unchanged": true,
      "detail": "Invalid credentials"
    },
    {
      "key": "not_admin",
      "status": 403,
      "unchanged": true,
      "detail": "Admin access required"
    },
    {
      "key": "foreign_cart",
      "status": 404,
      "unchanged": true,
      "detail": "cart_item_not_found"
    },
    {
      "key": "quantity_zero",
      "status": 422,
      "unchanged": true,
      "detail": [
        {
          "loc": [
            "body",
            "quantity"
          ],
          "msg": "Input should be greater than 0",
          "type": "greater_than"
        }
      ]
    },
    {
      "key": "negative_price",
      "status": 422,
      "unchanged": true,
      "detail": [
        {
          "loc": [
            "body",
            "price"
          ],
          "msg": "Input should be greater than 0",
          "type": "greater_than"
        }
      ]
    },
    {
      "key": "empty_email",
      "status": 422,
      "unchanged": true,
      "detail": [
        {
          "loc": [
            "body",
            "email"
          ],
          "msg": "value is not a valid email address: An email address must have an @-sign.",
          "type": "value_error"
        }
      ]
    },
    {
      "key": "short_second_item",
      "status": 409,
      "unchanged": true,
      "detail": "insufficient_stock"
    },
    {
      "key": "foreign_order",
      "status": 404,
      "unchanged": true,
      "detail": "order_not_found"
    },
    {
      "key": "status_forbidden",
      "status": 403,
      "unchanged": true,
      "detail": "Admin access required"
    }
  ],
  "journey": [
    {
      "step": "Вход",
      "status": 200,
      "result": "Аня подтверждена через /auth/me"
    },
    {
      "step": "Каталог",
      "status": 200,
      "result": "101: 7990.00 / stock 3; 201: 5990.00 / stock 5"
    },
    {
      "step": "Корзина",
      "status": 200,
      "result": "Две позиции, три пары, сумма 21970.00"
    },
    {
      "step": "Заказ",
      "status": 201,
      "result": "21970.00; stock 1 и 4; корзина пуста"
    },
    {
      "step": "История",
      "status": 200,
      "result": "Свой заказ виден; чужой ID возвращает 404"
    }
  ],
  "total": "21970.00",
  "regression": {
    "m23": 85,
    "m45": 76
  },
  "cleanup": "temporary directory and databases removed; working volume preserved"
};
