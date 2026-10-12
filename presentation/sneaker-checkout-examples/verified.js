window.SNEAKER_CHECKOUT = {
  "isolation": "READ COMMITTED",
  "checks": [
    "successful checkout total and owner",
    "both stock values updated",
    "only current cart cleared",
    "one new order and two new lines",
    "purchase prices and total stay after catalog change",
    "complete rollback at after_order",
    "complete rollback at after_first_stock",
    "complete rollback at after_cart_delete",
    "reject without changes: empty",
    "reject without changes: zero_stock",
    "reject without changes: too_many",
    "reject without changes: second_item_short",
    "unsafe stale write oversells while stock remains zero",
    "real lock wait observed: last_pair",
    "single new order: last_pair",
    "waiting buyer rechecks zero stock",
    "real lock wait observed: same_user",
    "single new order: same_user",
    "second checkout sees cleared cart",
    "real lock wait observed: cart_write",
    "single new order: cart_write",
    "cart change after checkout preserved",
    "database rejects zero quantity"
  ],
  "scenarios": {
    "success": {
      "before": {
        "sizes": [
          {
            "id": 101,
            "stock": 3
          },
          {
            "id": 102,
            "stock": 0
          },
          {
            "id": 201,
            "stock": 5
          },
          {
            "id": 301,
            "stock": 2
          }
        ],
        "cart": [
          {
            "id": 55,
            "user_id": 7,
            "product_size_id": 101,
            "quantity": 2
          },
          {
            "id": 56,
            "user_id": 7,
            "product_size_id": 201,
            "quantity": 1
          },
          {
            "id": 57,
            "user_id": 8,
            "product_size_id": 102,
            "quantity": 1
          }
        ],
        "orders": [
          {
            "id": 501,
            "user_id": 7,
            "status": "completed",
            "total": "21970.00"
          }
        ],
        "items": [
          {
            "id": 601,
            "order_id": 501,
            "product_size_id": 101,
            "quantity": 2,
            "price_at_purchase": "7990.00"
          },
          {
            "id": 602,
            "order_id": 501,
            "product_size_id": 201,
            "quantity": 1,
            "price_at_purchase": "5990.00"
          }
        ]
      },
      "after": {
        "sizes": [
          {
            "id": 101,
            "stock": 1
          },
          {
            "id": 102,
            "stock": 0
          },
          {
            "id": 201,
            "stock": 4
          },
          {
            "id": 301,
            "stock": 2
          }
        ],
        "cart": [
          {
            "id": 57,
            "user_id": 8,
            "product_size_id": 102,
            "quantity": 1
          }
        ],
        "orders": [
          {
            "id": 501,
            "user_id": 7,
            "status": "completed",
            "total": "21970.00"
          },
          {
            "id": 502,
            "user_id": 7,
            "status": "created",
            "total": "21970.00"
          }
        ],
        "items": [
          {
            "id": 601,
            "order_id": 501,
            "product_size_id": 101,
            "quantity": 2,
            "price_at_purchase": "7990.00"
          },
          {
            "id": 602,
            "order_id": 501,
            "product_size_id": 201,
            "quantity": 1,
            "price_at_purchase": "5990.00"
          },
          {
            "id": 603,
            "order_id": 502,
            "product_size_id": 101,
            "quantity": 2,
            "price_at_purchase": "7990.00"
          },
          {
            "id": 604,
            "order_id": 502,
            "product_size_id": 201,
            "quantity": 1,
            "price_at_purchase": "5990.00"
          }
        ]
      },
      "order": {
        "order_id": 502,
        "user_id": 7,
        "total": "21970.00",
        "status": "created"
      }
    },
    "price_snapshot": {
      "catalog_price": "8990.00",
      "price_at_purchase": "7990.00",
      "total": "21970.00"
    },
    "rollback": {
      "after_order": {
        "restored": true,
        "new_orders": 0,
        "cart_rows_user7": 2
      },
      "after_first_stock": {
        "restored": true,
        "new_orders": 0,
        "cart_rows_user7": 2
      },
      "after_cart_delete": {
        "restored": true,
        "new_orders": 0,
        "cart_rows_user7": 2
      }
    },
    "empty": {
      "outcome": "rejected",
      "reason": "empty_cart"
    },
    "zero_stock": {
      "outcome": "rejected",
      "reason": "insufficient_stock"
    },
    "too_many": {
      "outcome": "rejected",
      "reason": "insufficient_stock"
    },
    "second_item_short": {
      "outcome": "rejected",
      "reason": "insufficient_stock"
    },
    "unsafe_race": {
      "workers": [
        {
          "user_id": 7,
          "read_stock": 1,
          "outcome": "committed"
        },
        {
          "user_id": 8,
          "read_stock": 1,
          "outcome": "committed"
        }
      ],
      "new_orders": 2,
      "pairs_sold": 2,
      "initial_stock": 1,
      "final_stock": 0
    },
    "last_pair": {
      "first": {
        "outcome": "committed",
        "order_id": 502,
        "user_id": 7,
        "total": "7990.00",
        "status": "created"
      },
      "second": {
        "outcome": "rejected",
        "reason": "insufficient_stock"
      },
      "observed_wait": true,
      "new_orders": 1,
      "final_stock": 0,
      "remaining_cart": [
        {
          "id": 59,
          "user_id": 8,
          "product_size_id": 101,
          "quantity": 1
        }
      ]
    },
    "same_user": {
      "first": {
        "outcome": "committed",
        "order_id": 502,
        "user_id": 7,
        "total": "7990.00",
        "status": "created"
      },
      "second": {
        "outcome": "rejected",
        "reason": "empty_cart"
      },
      "observed_wait": true,
      "new_orders": 1,
      "final_stock": 0,
      "remaining_cart": []
    },
    "cart_write": {
      "first": {
        "outcome": "committed",
        "order_id": 502,
        "user_id": 7,
        "total": "7990.00",
        "status": "created"
      },
      "second": {
        "outcome": "committed",
        "added": true
      },
      "observed_wait": true,
      "new_orders": 1,
      "final_stock": 0,
      "remaining_cart": [
        {
          "id": 59,
          "user_id": 7,
          "product_size_id": 301,
          "quantity": 1
        }
      ]
    }
  }
};
