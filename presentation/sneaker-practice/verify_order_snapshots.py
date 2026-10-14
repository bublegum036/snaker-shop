"""Migration + real HTTP snapshot checks in a newly created disposable DB."""
import json
import os
import secrets
from pathlib import Path
from uuid import uuid4
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from app.core.config import database_url
from app.core.security import create_token
from app.database import make_engine
from app.seed import seed
from app.services.orders import checkout
from verify_m23 import server

ROOT = Path(__file__).resolve().parent


def verify():
    name = 'snapshots_check_' + uuid4().hex
    url = make_url(database_url())
    admin = create_engine(url.set(database='postgres'), isolation_level='AUTOCOMMIT', connect_args={'connect_timeout': 3})
    engine = None
    created = False
    checks = []
    def check(label, condition):
        assert condition, label
        checks.append(label)
    try:
        with admin.connect() as db:
            db.execute(text(f'CREATE DATABASE "{name}"'))
            created = True
        target = url.set(database=name)
        engine = make_engine(target)
        sessions = sessionmaker(engine)
        config = Config(str(ROOT / 'alembic.ini'))
        def migrate(action, revision):
            with engine.begin() as db:
                config.attributes['connection'] = db
                action(config, revision)
        migrate(command.upgrade, '0002')
        seed(engine)
        legacy = {'id': 501, 'user_id': 501, 'status': 'created', 'total': '7990.00',
            'created_at': '2026-10-12T12:00:00Z', 'items': [
                {'id': 501, 'product_size_id': 101, 'quantity': 1, 'price_at_purchase': '7990.00'}]}
        with engine.begin() as db:
            db.execute(text("INSERT INTO users(id,email,hashed_password) VALUES(501,'snapshots@example.test','disabled-fixture')"))
            db.execute(text("INSERT INTO orders(id,user_id,total,created_at) VALUES(501,501,7990,'2026-10-12T12:00:00Z')"))
            db.execute(text('INSERT INTO order_items(id,order_id,product_size_id,quantity,price_at_purchase) VALUES(501,501,101,1,7990)'))
            db.execute(text("INSERT INTO checkout_requests(user_id,key,order_id,response) VALUES(501,'legacy-key',501,CAST(:response AS jsonb))"), {'response': json.dumps(legacy)})
        table_names = ['users', 'brands', 'products', 'product_sizes', 'cart_items', 'orders', 'order_items', 'checkout_requests']
        def snapshot(include_new=False):
            with engine.connect() as db:
                return {table: [{key: value for key, value in row.items()
                    if include_new or key not in {'name_at_purchase', 'size_at_purchase'}}
                    for row in db.execute(text(f'SELECT * FROM {table} ORDER BY id')).mappings()]
                    for table in table_names}
        before = snapshot()
        migrate(command.upgrade, 'head')
        check('upgrade preserves existing rows and cached responses', snapshot() == before)
        with engine.connect() as db:
            check('legacy snapshots stay null', tuple(db.execute(text('SELECT name_at_purchase,size_at_purchase FROM order_items WHERE id=501')).one()) == (None, None))
        migrate(command.downgrade, '0002')
        check('downgrade preserves original rows', snapshot() == before)
        migrate(command.upgrade, 'head')
        with engine.begin() as db:
            config.attributes['connection'] = db
            command.check(config)
        check('repeat upgrade matches ORM metadata', snapshot() == before)
        secret = secrets.token_urlsafe(48)
        env = os.environ.copy()
        env.update(DATABASE_URL=target.render_as_string(hide_password=False), JWT_SECRET=secret)
        headers = {'Authorization': 'Bearer ' + create_token(501, secret)}
        with server('app.final_main:app', env) as client:
            old = client.get('/orders/501', headers=headers)
            check('legacy details return null fields', old.status_code == 200 and old.json()['items'][0]['name_at_purchase'] is None and old.json()['items'][0]['size_at_purchase'] is None)
            replay = client.post('/orders', headers={**headers, 'Idempotency-Key': 'legacy-key'}, json={})
            expected = {**legacy, 'items': [{**legacy['items'][0], 'name_at_purchase': None, 'size_at_purchase': None}]}
            check('legacy idempotency response remains replayable', replay.status_code == 201 and replay.json() == expected)
            response = client.post('/cart/items', headers=headers, json={'product_size_id': 101, 'quantity': 1})
            check('fixture adds a position', response.status_code == 200)
            result = client.post('/orders', headers={**headers, 'Idempotency-Key': 'snapshot-key'}, json={})
            check('new checkout succeeds', result.status_code == 201)
            order = result.json()
            item = order['items'][0]
            check('new order stores name size and price', (item['name_at_purchase'], item['size_at_purchase'], item['price_at_purchase']) == ('North Runner', '42.0', '7990.00'))
            with engine.begin() as db:
                db.execute(text("UPDATE products SET name='Renamed catalog product',price=123 WHERE id=10"))
                db.execute(text('UPDATE product_sizes SET size=42.5 WHERE id=101'))
            details = client.get(f"/orders/{order['id']}", headers=headers).json()
            check('catalog changes do not alter order snapshots', details == order)
            history = client.get('/orders', headers=headers).json()
            check('history includes saved snapshot fields', next(value for value in history if value['id'] == order['id']) == order)
            replay = client.post('/orders', headers={**headers, 'Idempotency-Key': 'snapshot-key'}, json={})
            check('retry preserves original snapshot response', replay.status_code == 201 and replay.json() == order)
            check('catalog rename does not backfill legacy snapshots', client.get('/orders/501', headers=headers).json()['items'][0]['name_at_purchase'] is None)
            foreign = client.post('/auth/register', json={'email': 'other-snapshot@example.com', 'password': 'fixture-only-password'})
            check('second fixture account registers', foreign.status_code == 201)
            token = create_token(foreign.json()['id'], secret)
            check('foreign snapshot order stays protected', client.get(f"/orders/{order['id']}", headers={'Authorization': 'Bearer ' + token}).status_code == 404)
        with engine.begin() as db:
            db.execute(text('INSERT INTO cart_items(user_id,product_size_id,quantity) VALUES(501,201,1)'))
        def fail(stage, db):
            if stage == 'after_first_stock':
                raise RuntimeError('fixture rollback')
        before_failure = snapshot(include_new=True)
        try:
            checkout(501, idempotency_key='rollback-key', sessions=sessions, _test_hook=fail)
        except RuntimeError:
            pass
        else:
            raise AssertionError('Injected failure did not occur')
        check('rollback removes new snapshots and preserves stock cart and cache', snapshot(include_new=True) == before_failure)
        for label, values in [('partial snapshot', "'Only a name',NULL"), ('zero snapshot size', "'Name',0")]:
            try:
                with engine.begin() as db:
                    db.execute(text('INSERT INTO order_items(order_id,product_size_id,quantity,price_at_purchase,name_at_purchase,size_at_purchase) VALUES(501,101,1,7990,' + values + ')'))
            except IntegrityError as error:
                check(label + ' is rejected', error.orig.sqlstate == '23514')
            else:
                raise AssertionError(label)
        return checks
    finally:
        if engine is not None:
            engine.dispose()
        if created:
            with admin.connect() as db:
                db.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()


if __name__ == '__main__':
    print(json.dumps({'checks': verify()}, ensure_ascii=False))
