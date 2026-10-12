window.SNEAKER_M45 = {
  "ownership": {
    "boris": {
      "patch": 404,
      "delete": 404,
      "unchanged": true
    },
    "admin": {
      "patch": 404,
      "delete": 404,
      "unchanged": true
    }
  },
  "cart_errors": [
    {
      "case": "zero",
      "status": 422,
      "unchanged": true
    },
    {
      "case": "negative",
      "status": 422,
      "unchanged": true
    },
    {
      "case": "boolean",
      "status": 422,
      "unchanged": true
    },
    {
      "case": "owner_in_body",
      "status": 422,
      "unchanged": true
    },
    {
      "case": "unknown_size",
      "status": 404,
      "unchanged": true
    },
    {
      "case": "zero_stock",
      "status": 409,
      "unchanged": true
    },
    {
      "case": "sum_exceeds_stock",
      "status": 409,
      "unchanged": true
    }
  ],
  "rollback": [
    {
      "stage": "after_order",
      "restored": true,
      "orders": 0,
      "cart_rows": 2,
      "stock101": 3,
      "stock201": 5
    },
    {
      "stage": "after_first_stock",
      "restored": true,
      "orders": 0,
      "cart_rows": 2,
      "stock101": 3,
      "stock201": 5
    },
    {
      "stage": "after_cart_delete",
      "restored": true,
      "orders": 0,
      "cart_rows": 2,
      "stock101": 3,
      "stock201": 5
    }
  ],
  "races": [
    {
      "case": "last_pair",
      "statuses": [
        201,
        409
      ],
      "observed_waits": 2,
      "orders": 1,
      "stock": 0,
      "remaining_cart_rows": 1
    },
    {
      "case": "same_user",
      "statuses": [
        201,
        409
      ],
      "observed_waits": 2,
      "orders": 1,
      "remaining_cart_rows": 0
    },
    {
      "case": "cart_write",
      "statuses": [
        201,
        200
      ],
      "observed_waits": 2,
      "new_cart_size": 301,
      "remaining_cart_rows": 1
    }
  ],
  "success": {
    "total": "21970.00",
    "status": "created",
    "positions": 2,
    "stocks": {
      "101": 1,
      "102": 0,
      "201": 4,
      "301": 2
    },
    "own_cart_rows": 0,
    "other_cart_preserved": true
  },
  "shortage": {
    "status": 409,
    "all_rows_unchanged": true,
    "cart_rows": 2
  },
  "timeout": {
    "status": 409,
    "unchanged": true
  },
  "checks": [
    "M4 cart route protected",
    "M4 has no checkout routes",
    "anya registered",
    "boris registered",
    "admin registered",
    "unauthenticated GET /cart",
    "unauthenticated POST /cart/items",
    "unauthenticated PATCH /cart/items/1",
    "unauthenticated DELETE /cart/items/1",
    "unauthenticated POST /orders",
    "unauthenticated GET /orders",
    "unauthenticated GET /orders/1",
    "unauthenticated PATCH /orders/1/status",
    "empty cart is normal",
    "cart POST returns own size row",
    "repeat add increments same item",
    "cart subtotal and total computed from DB",
    "cart is not a stock reservation",
    "second user initially sees empty cart",
    "boris cannot PATCH foreign cart",
    "boris cannot DELETE foreign cart",
    "boris foreign actions preserve state",
    "admin cannot PATCH foreign cart",
    "admin cannot DELETE foreign cart",
    "admin foreign actions preserve state",
    "cart rejects zero",
    "cart rejects negative",
    "cart rejects boolean",
    "cart rejects owner_in_body",
    "cart rejects unknown_size",
    "cart rejects zero_stock",
    "cart rejects sum_exceeds_stock",
    "PATCH sets absolute quantity",
    "PATCH rejects zero",
    "PATCH rejects too_many",
    "unknown cart item is 404",
    "DELETE own item returns empty 204",
    "repeat cart deletion is 404",
    "deleting own item preserves other cart",
    "empty checkout is 409",
    "checkout rejects client totals and owner",
    "checkout returns 201",
    "checkout total owner status and snapshots",
    "own cart cleared after checkout",
    "checkout leaves other cart intact",
    "checkout deducts both stocks once",
    "own order detail and history visible",
    "boris cannot read foreign order detail",
    "boris history excludes foreign order",
    "admin cannot read foreign order detail",
    "admin history excludes foreign order",
    "unknown order returns 404",
    "history validates pagination",
    "anya cannot change order status",
    "boris cannot change order status",
    "unknown status is 422",
    "skipped transition is 409",
    "admin status processing",
    "admin status processing",
    "admin status completed",
    "backward transition is 409",
    "status changes never alter stock or positions",
    "admin unknown order status is 404",
    "history keeps old prices after catalog edit",
    "repeated checkout sees empty cart not duplicate",
    "short second position rejects whole order",
    "ORM rollback after_order",
    "ORM rollback after_first_stock",
    "ORM rollback after_cart_delete",
    "fault hook is not an HTTP option",
    "two HTTP buyers of last pair get 201 and 409",
    "last pair creates one order and preserves losing cart",
    "two checkouts of same cart create one order",
    "same-user order count is one",
    "cart edit waits and remains after checkout",
    "lock timeout maps to controlled 409 and rollback"
  ],
  "database": "new disposable database",
  "isolation": "READ COMMITTED",
  "rollback_transport": "direct calls to the same ORM service",
  "race_transport": "real HTTP and observed database lock waits"
};
