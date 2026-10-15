"""Admin reads and status transitions in a fresh disposable PostgreSQL database."""
import json
import os
import secrets
from pathlib import Path
from uuid import uuid4
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from app.core.config import database_url
from app.core.security import create_token
from app.database import make_engine
from app.seed import seed
from verify_m23 import server

ROOT = Path(__file__).resolve().parent


def verify():
    name = 'admin_orders_check_' + uuid4().hex
    url = make_url(database_url())
    admin_engine = create_engine(url.set(database='postgres'), isolation_level='AUTOCOMMIT', connect_args={'connect_timeout': 3})
    engine = None
    created = False
    checks = []
    def check(label, condition):
        assert condition, label
        checks.append(label)
    try:
        with admin_engine.connect() as db:
            db.execute(text(f'CREATE DATABASE "{name}"'))
            created = True
        target = url.set(database=name)
        engine = make_engine(target)
        config = Config(str(ROOT / 'alembic.ini'))
        with engine.begin() as db:
            config.attributes['connection'] = db
            command.upgrade(config, 'head')
        seed(engine)
        with engine.begin() as db:
            for user_id in (501, 502, 503):
                db.execute(text('INSERT INTO users(id,email,hashed_password,is_admin) VALUES(:id,:email,:password,:admin)'),
                    {'id': user_id, 'email': f'fixture-{user_id}@example.test', 'password': 'disabled-fixture', 'admin': user_id == 503})
        secret = secrets.token_urlsafe(48)
        env = os.environ.copy()
        env.update(DATABASE_URL=target.render_as_string(hide_password=False), JWT_SECRET=secret)
        headers = {user_id: {'Authorization': 'Bearer ' + create_token(user_id, secret)} for user_id in (501, 502, 503)}
        with server('app.final_main:app', env) as client:
            for path in ('/admin/orders', '/admin/orders/1'):
                check('anonymous denied ' + path, client.get(path).status_code == 401)
                check('customer denied ' + path, client.get(path, headers=headers[501]).status_code == 403)
            check('empty admin history', client.get('/admin/orders', headers=headers[503]).json() == [])
            orders = []
            for user_id, size_id in ((501, 101), (502, 201)):
                assert client.post('/cart/items', headers=headers[user_id], json={'product_size_id': size_id, 'quantity': 1}).status_code == 200
                response = client.post('/orders', headers={**headers[user_id], 'Idempotency-Key': f'fixture-{user_id}'}, json={})
                assert response.status_code == 201
                orders.append(response.json())
            listing = client.get('/admin/orders', headers=headers[503]).json()
            check('administrator sees all users in descending order', [value['id'] for value in listing] == [orders[1]['id'], orders[0]['id']] and {value['user_id'] for value in listing} == {501, 502})
            check('admin list has no user secrets', all(set(value) == {'id', 'user_id', 'status', 'total', 'created_at', 'items'} for value in listing))
            check('pagination applies on server', client.get('/admin/orders?limit=1&offset=1', headers=headers[503]).json() == [orders[0]])
            for path in ('/admin/orders?limit=0', '/admin/orders?offset=-1', '/admin/orders?status=invalid', '/admin/orders/0'):
                check('invalid query rejected ' + path, client.get(path, headers=headers[503]).status_code == 422)
            check('admin details include original snapshots', client.get(f"/admin/orders/{orders[0]['id']}", headers=headers[503]).json() == orders[0])
            check('unknown admin order is 404', client.get('/admin/orders/2147483647', headers=headers[503]).status_code == 404)
            check('personal history stays scoped even for administrator', client.get('/orders', headers=headers[503]).json() == [])
            check('customer history stays scoped', client.get('/orders', headers=headers[501]).json() == [orders[0]])
            check('customer cannot read foreign details', client.get(f"/orders/{orders[1]['id']}", headers=headers[501]).status_code == 404)
            def invariant():
                with engine.connect() as db:
                    return {table: [tuple(row) for row in db.execute(text(f'SELECT * FROM {table} ORDER BY id'))]
                        for table in ('product_sizes', 'cart_items', 'order_items', 'checkout_requests')}
            before = invariant()
            order_id = orders[0]['id']
            response = client.patch(f'/orders/{order_id}/status', headers=headers[503], json={'status': 'processing'})
            check('admin advances created to processing', response.status_code == 200 and response.json()['status'] == 'processing')
            check('status filter applies on server', client.get('/admin/orders?status=processing', headers=headers[503]).json() == [response.json()])
            check('same status is repeatable', client.patch(f'/orders/{order_id}/status', headers=headers[503], json={'status': 'processing'}).json() == response.json())
            response = client.patch(f'/orders/{order_id}/status', headers=headers[503], json={'status': 'completed'})
            check('admin completes processing order', response.status_code == 200 and response.json()['status'] == 'completed')
            check('backwards transition is rejected', client.patch(f'/orders/{order_id}/status', headers=headers[503], json={'status': 'created'}).status_code == 409)
            check('customer cannot change status', client.patch(f'/orders/{orders[1]["id"]}/status', headers=headers[501], json={'status': 'processing'}).status_code == 403)
            check('status changes preserve inventory items cart and idempotent responses', invariant() == before)
            with engine.begin() as db:
                db.execute(text('UPDATE users SET is_admin=false WHERE id=503'))
            check('revoked role cannot read admin list', client.get('/admin/orders', headers=headers[503]).status_code == 403)
            check('revoked role cannot read admin details', client.get(f'/admin/orders/{order_id}', headers=headers[503]).status_code == 403)
            check('revoked role cannot change status', client.patch(f'/orders/{orders[1]["id"]}/status', headers=headers[503], json={'status': 'processing'}).status_code == 403)
        return checks
    finally:
        if engine is not None:
            engine.dispose()
        if created:
            with admin_engine.connect() as db:
                db.execute(text(f'DROP DATABASE "{name}"'))
        admin_engine.dispose()


if __name__ == '__main__':
    print(json.dumps({'checks': verify()}, ensure_ascii=False))
