"""Replay, rollback and concurrent HTTP retries on the disposable final DB."""
from concurrent.futures import ThreadPoolExecutor
import os
import time
from sqlalchemy import select, text
from sqlalchemy.orm import sessionmaker
from app.models import Base
from app.services.orders import checkout
from verify_m23 import server


def verify_idempotency(client, admin, engine):
    checks = []

    def check(label, condition):
        assert condition, label
        checks.append('idempotency: ' + label)

    def snapshot():
        with engine.connect() as db:
            return {name: [tuple(row) for row in db.execute(select(table).order_by(table.c.id))]
                    for name, table in Base.metadata.tables.items()}

    def account(name):
        credentials = {'email': name + '@example.com', 'password': 'Study-only-' + name + '!'}
        response = client.post('/auth/register', json=credentials)
        assert response.status_code == 201
        login = client.post('/auth/login', json=credentials)
        assert login.status_code == 200
        return response.json()['id'], {'Authorization': 'Bearer ' + login.json()['access_token']}

    uid, auth = account('replay-a')
    other_id, other = account('replay-b')
    product = client.post('/products', headers=admin,
                          json={'name': 'Replay Pair', 'brand_id': 1, 'price': '250.00'})
    assert product.status_code == 201
    pid = product.json()['id']
    size = client.post(f'/products/{pid}/sizes', headers=admin, json={'size': '40', 'stock': 50})
    assert size.status_code == 201
    sid = size.json()['id']
    size_path = f'/products/{pid}/sizes/{sid}'

    def headers(key, identity=auth):
        return {**identity, 'Idempotency-Key': key}

    def add(quantity=1, identity=auth):
        response = client.post('/cart/items', headers=identity,
                               json={'product_size_id': sid, 'quantity': quantity})
        assert response.status_code == 200

    def rejected(label, request_headers, body, status):
        before = snapshot()
        response = client.post('/orders', headers=request_headers, json=body)
        check(label, response.status_code == status and snapshot() == before)
        return response

    parameter = next(p for p in client.get('/openapi.json').json()['paths']['/orders']['post']['parameters']
                     if p['name'] == 'Idempotency-Key')
    check('Swagger exposes optional header', parameter['in'] == 'header' and not parameter['required'])
    rejected('key does not bypass authentication', {'Idempotency-Key': 'first-purchase'}, {}, 401)
    for key in ['', 'has space', 'x' * 129, 'comma,key']:
        rejected('invalid header ' + repr(key), headers(key), {}, 422)
    duplicate = [('Authorization', auth['Authorization']),
                 ('Idempotency-Key', 'first-purchase'), ('Idempotency-Key', 'other-purchase')]
    rejected('duplicate header is rejected', duplicate, {}, 422)
    response = rejected('empty cart does not consume key', headers('first-purchase'), {}, 409)
    check('empty cart error is explicit', response.json()['detail'] == 'empty_cart')

    add(2)
    response = client.post('/orders', headers=headers('first-purchase'), json={})
    check('first keyed purchase succeeds', response.status_code == 201 and response.json()['total'] == '500.00')
    original = response.json()
    with engine.connect() as db:
        check('one durable key linked to purchase', db.scalar(text(
            'SELECT count(*) FROM checkout_requests WHERE user_id=:uid AND key=:key AND order_id=:oid'),
            {'uid': uid, 'key': 'first-purchase', 'oid': original['id']}) == 1)
        check('keyed purchase deducts stock once', db.scalar(text(
            'SELECT stock FROM product_sizes WHERE id=:id'), {'id': sid}) == 48)
    before = snapshot()
    for label, body in [('empty JSON', {}), ('absent body', None)]:
        response = client.post('/orders', headers=headers('first-purchase'), json=body)
        check('lost response retry with ' + label, response.status_code == 201
              and response.json() == original and snapshot() == before)
    rejected('replay still validates body', headers('first-purchase'), {'total': '1.00'}, 422)
    response = client.post('/orders', headers=headers('first-purchase', other), json={})
    check('same key cannot read another users result', response.status_code == 409
          and response.json()['detail'] == 'empty_cart' and snapshot() == before)
    add(1, other)
    response = client.post('/orders', headers=headers('first-purchase', other), json={})
    check('same key allowed for another user', response.status_code == 201
          and response.json()['user_id'] == other_id and response.json()['id'] != original['id'])

    response = client.patch(f'/orders/{original["id"]}/status', headers=admin, json={'status': 'processing'})
    assert response.status_code == 200
    response = client.put(f'/products/{pid}', headers=admin,
                         json={'name': 'Replay Pair', 'brand_id': 1, 'price': '300.00',
                               'version': client.get(f'/products/{pid}').json()['version']})
    assert response.status_code == 200
    add()
    before = snapshot()
    response = client.post('/orders', headers=headers('first-purchase'), json={})
    check('replay preserves original snapshot and newly filled cart', response.status_code == 201
          and response.json() == original and snapshot() == before)
    check('order detail shows actual current status',
          client.get(f'/orders/{original["id"]}', headers=auth).json()['status'] == 'processing')
    # A new Uvicorn process proves the result does not live in an in-memory cache.
    with server('app.final_main:app', os.environ.copy()) as fresh:
        response = fresh.post('/orders', headers=headers('first-purchase'), json={})
        check('retry survives server restart', response.status_code == 201
              and response.json() == original and snapshot() == before)
    response = client.post('/orders', headers=headers('second-purchase'), json={})
    check('new key buys the new cart at current price', response.status_code == 201
          and response.json()['id'] != original['id'] and response.json()['total'] == '300.00')
    rejected('missing key keeps legacy empty-cart response', auth, {}, 409)
    add()
    records_before = len(snapshot()['checkout_requests'])
    response = client.post('/orders', headers=auth, json={})
    check('legacy purchase does not create a request record', response.status_code == 201
          and len(snapshot()['checkout_requests']) == records_before)

    # Inject faults after writes, including AFTER recording the replay response.
    add(2)
    sessions = sessionmaker(engine)
    for fault in ['after_order', 'after_first_stock', 'after_cart_delete', 'after_idempotency_record']:
        before = snapshot()

        def inject(stage, db):
            if stage == fault:
                raise RuntimeError('Injected idempotency test fault')

        try:
            checkout(uid, idempotency_key='fault-' + fault, sessions=sessions, _test_hook=inject)
        except RuntimeError as error:
            assert str(error) == 'Injected idempotency test fault'
        else:
            raise AssertionError('Idempotency fault was not injected')
        check('rollback including key at ' + fault, snapshot() == before)
    response = client.post('/orders', headers=headers('fault-after_idempotency_record'), json={})
    check('rolled-back key can be retried successfully', response.status_code == 201
          and response.json()['total'] == '600.00')

    add()
    stock = client.get(f'/products/{pid}').json()['sizes'][0]['stock']
    assert client.patch(size_path, headers=admin, json={'stock': 0}).status_code == 200
    rejected('stock failure does not consume key', headers('restock-retry'), {}, 409)
    assert client.patch(size_path, headers=admin, json={'stock': stock}).status_code == 200
    response = client.post('/orders', headers=headers('restock-retry'), json={})
    check('retry after restock uses the previously failed key', response.status_code == 201)

    def wait_for_locks(gate):
        deadline = time.monotonic() + 2
        while True:
            count = gate.scalar(text("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() "
                                     "AND pid<>pg_backend_pid() AND wait_event_type='Lock' "
                                     "AND cardinality(pg_blocking_pids(pid))>0"))
            if count >= 2:
                return
            if time.monotonic() >= deadline:
                raise AssertionError('Did not observe both checkout retries waiting for a lock')
            time.sleep(.02)

    def race(keys):
        with ThreadPoolExecutor(max_workers=2) as pool:
            with engine.connect() as gate:
                gate.execute(text('SELECT id FROM users WHERE id=:id FOR UPDATE'), {'id': uid})
                try:
                    futures = [pool.submit(client.post, '/orders', headers=headers(key), json={}) for key in keys]
                    wait_for_locks(gate)
                finally:
                    gate.rollback()
            return [future.result(timeout=15) for future in futures]

    add()
    before = snapshot()
    responses = race(['concurrent-retry', 'concurrent-retry'])
    after = snapshot()
    check('concurrent same-key requests return identical 201',
          all(r.status_code == 201 for r in responses) and responses[0].json() == responses[1].json())
    before_stock = next(row[3] for row in before['product_sizes'] if row[0] == sid)
    after_stock = next(row[3] for row in after['product_sizes'] if row[0] == sid)
    check('concurrent retry creates one order and deducts once',
          len(after['orders']) == len(before['orders']) + 1
          and len(after['checkout_requests']) == len(before['checkout_requests']) + 1
          and after_stock == before_stock - 1
          and client.get('/cart', headers=auth).json()['items'] == [])
    add()
    before = snapshot()
    responses = race(['different-key-a', 'different-key-b'])
    after = snapshot()
    check('different keys compete for one cart', sorted(r.status_code for r in responses) == [201, 409]
          and len(after['orders']) == len(before['orders']) + 1
          and len(after['checkout_requests']) == len(before['checkout_requests']) + 1)
    check('successful responses remain replayable after races',
          client.post('/orders', headers=headers('first-purchase'), json={}).json() == original)
    return checks
