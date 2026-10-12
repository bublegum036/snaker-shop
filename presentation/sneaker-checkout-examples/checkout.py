"""Teaching transaction using psycopg/SQL, not the final ORM/API implementation."""
from decimal import Decimal

class CheckoutRejected(Exception):
    pass


def checkout(conn, user_id, *, fail_at=None, after_lock=None):
    """Fresh autocommit connection; user_id must already be authenticated by API.

    Every cart writer in this lesson follows the same users-row lock protocol.
    The function owns the transaction. Hooks are exclusively for fault/race tests.
    """
    with conn.transaction():
        conn.execute("SET LOCAL lock_timeout = '6s'")
        conn.execute("SET LOCAL statement_timeout = '8s'")
        owner = conn.execute('SELECT id FROM users WHERE id=%s FOR UPDATE', (user_id,)).fetchone()
        if owner is None:
            raise CheckoutRejected('unknown_user')
        items = conn.execute('SELECT id, product_size_id, quantity FROM cart_items WHERE user_id=%s ORDER BY product_size_id', (user_id,)).fetchall()
        if not items:
            raise CheckoutRejected('empty_cart')
        if any(item['quantity'] <= 0 for item in items):
            raise CheckoutRejected('invalid_quantity')
        sizes = {}
        # Same lock order for all checkout workers; no ORM identity-map cache.
        for item in items:
            row = conn.execute('SELECT id, product_id, stock FROM product_sizes WHERE id=%s FOR UPDATE', (item['product_size_id'],)).fetchone()
            if row is None:
                raise CheckoutRejected('missing_size')
            sizes[row['id']] = row
        prices = {}
        for product_id in sorted({row['product_id'] for row in sizes.values()}):
            product = conn.execute('SELECT id, price FROM products WHERE id=%s FOR SHARE', (product_id,)).fetchone()
            if product is None:
                raise CheckoutRejected('missing_product')
            prices[product_id] = product['price']
        if after_lock:
            after_lock(conn)
        # Check current values only after the locking reads have completed.
        for item in items:
            if sizes[item['product_size_id']]['stock'] < item['quantity']:
                raise CheckoutRejected('insufficient_stock')
        total = sum((prices[sizes[item['product_size_id']]['product_id']] * item['quantity'] for item in items), Decimal('0.00'))
        order = conn.execute("INSERT INTO orders(user_id,status,total) VALUES (%s,'created',%s) RETURNING id", (user_id,total)).fetchone()
        order_id = order['id']
        if fail_at == 'after_order':
            raise RuntimeError('Injected failure after order insertion')
        for index,item in enumerate(items):
            size_id = item['product_size_id']
            price = prices[sizes[size_id]['product_id']]
            conn.execute('INSERT INTO order_items(order_id,product_size_id,quantity,price_at_purchase) VALUES (%s,%s,%s,%s)', (order_id,size_id,item['quantity'],price))
            conn.execute('UPDATE product_sizes SET stock=stock-%s WHERE id=%s', (item['quantity'],size_id))
            if index == 0 and fail_at == 'after_first_stock':
                raise RuntimeError('Injected failure after first stock update')
        conn.execute('DELETE FROM cart_items WHERE user_id=%s', (user_id,))
        if fail_at == 'after_cart_delete':
            raise RuntimeError('Injected failure after cart deletion')
    # Returning happens only after the context has successfully committed.
    return {'order_id':order_id,'user_id':user_id,'total':str(total),'status':'created'}


def add_cart_item(conn, user_id, size_id, quantity):
    """Illustrate the same per-user lock protocol for a concurrent cart writer."""
    if quantity <= 0:
        raise CheckoutRejected('invalid_quantity')
    with conn.transaction():
        conn.execute("SET LOCAL lock_timeout = '6s'")
        if conn.execute('SELECT id FROM users WHERE id=%s FOR UPDATE',(user_id,)).fetchone() is None:
            raise CheckoutRejected('unknown_user')
        conn.execute('''INSERT INTO cart_items(user_id,product_size_id,quantity) VALUES (%s,%s,%s)
            ON CONFLICT(user_id,product_size_id) DO UPDATE SET quantity=cart_items.quantity+EXCLUDED.quantity''', (user_id,size_id,quantity))
    return {'added':True}
