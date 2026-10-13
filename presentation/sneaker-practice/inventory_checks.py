"""Inventory acceptance on the disposable DB owned by verify_final.py."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import time
from sqlalchemy import select, text
from app.models import Base


def verify_inventory(client, admin, user, other, engine):
    checks = []

    def check(label, condition):
        assert condition, label
        checks.append('inventory: ' + label)

    def snapshot():
        with engine.connect() as db:
            return {name: [tuple(row) for row in db.execute(select(table).order_by(table.c.id))]
                    for name, table in Base.metadata.tables.items()}

    def rejected(label, method, path, body, status, headers=admin, reason=None):
        before = snapshot()
        response = client.request(method, path, json=body, headers=headers)
        check(label, response.status_code == status and snapshot() == before
              and (reason is None or response.json()['detail'] == reason))

    spec = client.get('/openapi.json').json()
    paths = [('/products/{product_id}/sizes', 'post'),
             ('/products/{product_id}/sizes/{size_id}', 'patch'),
             ('/products/{product_id}/sizes/{size_id}', 'delete')]
    check('all writes advertise Bearer security', all(spec['paths'][p][m].get('security') for p, m in paths))
    body = {'name': 'Inventory Pair', 'brand_id': 1, 'price': '100.00'}
    response = client.post('/products', headers=admin, json=body)
    check('new product has no sizes', response.status_code == 201 and response.json()['sizes'] == [])
    pid = response.json()['id']
    path = f'/products/{pid}/sizes'
    response = client.post(path, headers=admin, json={'size': '42.0', 'stock': 2})
    check('create size', response.status_code == 201 and response.json()['size'] == '42.0'
          and response.json()['stock'] == 2)
    sid = response.json()['id']
    item = f'{path}/{sid}'
    check('size visible in public product', client.get(f'/products/{pid}').json()['sizes'] == [response.json()])
    for identity, headers, status in [('anonymous', {}, 401), ('ordinary', user, 403)]:
        for method, url, data in [('POST', path, {'size': '43.0', 'stock': 1}),
                                  ('PATCH', item, {'stock': 3}), ('DELETE', item, None)]:
            rejected(identity + ' cannot ' + method, method, url, data, status, headers)
    for data in [
        {'size': '0', 'stock': 1}, {'size': '42.01', 'stock': 1},
        {'size': '1000', 'stock': 1}, {'size': 'NaN', 'stock': 1},
        {'size': 'Infinity', 'stock': 1}, {'size': '43', 'stock': -1},
        {'size': '43', 'stock': 2147483648}, {'size': '43', 'stock': True},
        {'size': '43', 'stock': '2'}, {'size': '43', 'stock': 1, 'product_id': 10},
    ]:
        rejected('invalid create ' + repr(data), 'POST', path, data, 422)
    for data in [{}, {'stock': None}, {'size': None}, {'stock': -1},
                 {'stock': True}, {'stock': 1.5}, {'stock': 2147483648},
                 {'size': '42.01'}, {'size': 'NaN'}, {'product_id': 10}]:
        rejected('invalid patch ' + repr(data), 'PATCH', item, data, 422)
    rejected('duplicate numeric size', 'POST', path, {'size': '42.00', 'stock': 7},
             409, reason='size_already_exists')
    rejected('unknown parent', 'POST', '/products/2147483647/sizes',
             {'size': '42', 'stock': 1}, 404, reason='product_not_found')
    rejected('unknown size', 'PATCH', path + '/2147483647', {'stock': 1}, 404)
    rejected('size cannot be patched under another product', 'PATCH',
             f'/products/20/sizes/{sid}', {'stock': 1}, 404)
    rejected('size cannot be deleted under another product', 'DELETE',
             f'/products/20/sizes/{sid}', None, 404)
    response = client.patch(item, headers=admin, json={'size': '42.5'})
    check('rename unused size preserves stock', response.status_code == 200
          and response.json()['size'] == '42.5' and response.json()['stock'] == 2)
    spare = client.post(path, headers=admin, json={'size': '43', 'stock': 0})
    check('create sold-out size', spare.status_code == 201 and spare.json()['stock'] == 0)
    spare_id = spare.json()['id']
    rejected('patch duplicate size rolls back stock too', 'PATCH', item,
             {'size': '43', 'stock': 8}, 409, reason='size_already_exists')
    response = client.delete(f'{path}/{spare_id}', headers=admin)
    check('delete unused size has empty 204', response.status_code == 204 and not response.content)
    rejected('delete missing size', 'DELETE', f'{path}/{spare_id}', None, 404)
    response = client.post('/cart/items', headers=user, json={'product_size_id': sid, 'quantity': 2})
    check('new size can be added to cart', response.status_code == 200)
    rejected('cart reference prevents rename', 'PATCH', item, {'size': '44'},
             409, reason='size_referenced')
    rejected('cart reference prevents delete', 'DELETE', item, None, 409, reason='size_referenced')
    response = client.patch(item, headers=admin, json={'stock': 0})
    check('stock may fall below cart quantity', response.status_code == 200 and response.json()['stock'] == 0)
    rejected('checkout rechecks changed inventory', 'POST', '/orders', {},
             409, user, 'insufficient_stock')
    response = client.patch(item, headers=admin, json={'stock': 5})
    check('absolute restock preserves size', response.status_code == 200
          and response.json()['stock'] == 5 and response.json()['size'] == '42.5')
    response = client.post('/orders', headers=user, json={})
    check('purchase newly created inventory', response.status_code == 201
          and response.json()['total'] == '200.00'
          and response.json()['items'][0]['product_size_id'] == sid)
    oid = response.json()['id']
    with engine.connect() as db:
        check('purchase decrements new size once', db.scalar(
            text('SELECT stock FROM product_sizes WHERE id=:id'), {'id': sid}) == 3)
    rejected('history prevents rename', 'PATCH', item, {'size': '44'},
             409, reason='size_referenced')
    rejected('history prevents deletion', 'DELETE', item, None, 409, reason='size_referenced')
    response = client.patch(item, headers=admin, json={'size': '42.5', 'stock': 4})
    check('unchanged size and restock allowed with history', response.status_code == 200
          and response.json()['stock'] == 4)
    check('restock preserves order snapshot', client.get(f'/orders/{oid}', headers=user).json()['items'][0]
          ['price_at_purchase'] == '100.00')

    # Two requests race on an absent variant: the UNIQUE constraint is authoritative.
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(client.post, path, headers=admin, json={'size': '45', 'stock': 1})
                   for _ in range(2)]
        responses = [future.result(timeout=15) for future in futures]
    check('duplicate create race produces one 201 and one 409',
          sorted(r.status_code for r in responses) == [201, 409])
    with engine.connect() as db:
        check('duplicate race inserted one row', db.scalar(text(
            'SELECT count(*) FROM product_sizes WHERE product_id=:id AND size=45'), {'id': pid}) == 1)
    race_id = next(r.json()['id'] for r in responses if r.status_code == 201)
    race_path = f'{path}/{race_id}'
    response = client.post('/cart/items', headers=other, json={'product_size_id': race_id, 'quantity': 1})
    check('race buyer has one pair in cart', response.status_code == 200)
    race_cart_id = response.json()['id']

    def wait_for_locks(gate, minimum):
        deadline = time.monotonic() + 2
        while True:
            count = gate.scalar(text("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() "
                                     "AND pid<>pg_backend_pid() AND wait_event_type='Lock' "
                                     "AND cardinality(pg_blocking_pids(pid))>0"))
            if count >= minimum:
                return
            if time.monotonic() >= deadline:
                raise AssertionError('Inventory race did not produce observable row lock waits')
            time.sleep(.02)

    # Hold the row, observe both real HTTP writers waiting, then release it.
    with ThreadPoolExecutor(max_workers=2) as pool:
        with engine.connect() as gate:
            gate.execute(text('SELECT id FROM product_sizes WHERE id=:id FOR UPDATE'), {'id': race_id})
            try:
                update = pool.submit(client.patch, race_path, headers=admin, json={'stock': 0})
                wait_for_locks(gate, 1)
                purchase = pool.submit(client.post, '/orders', headers=other, json={})
                wait_for_locks(gate, 2)
            finally:
                gate.rollback()
        update_response = update.result(timeout=15)
        purchase_response = purchase.result(timeout=15)
    check('stock edit and checkout share observed row locks', update_response.status_code == 200
          and purchase_response.status_code in {201, 409})
    with engine.connect() as db:
        stock = db.scalar(text('SELECT stock FROM product_sizes WHERE id=:id'), {'id': race_id})
        items = db.execute(text('SELECT quantity,price_at_purchase FROM order_items WHERE product_size_id=:id'),
                           {'id': race_id}).all()
        cart = db.scalar(text('SELECT quantity FROM cart_items WHERE id=:id'), {'id': race_cart_id})
    if purchase_response.status_code == 409:
        check('failed concurrent purchase preserves cart and creates no order', stock == 0 and not items
              and cart == 1 and purchase_response.json()['detail'] == 'insufficient_stock')
    else:
        check('successful concurrent purchase is atomic', stock == 0 and len(items) == 1
              and items[0].quantity == 1 and items[0].price_at_purchase == Decimal('100.00') and cart is None)
    return checks
