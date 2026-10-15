"""PostgreSQL checks in an owned disposable DB: rollback, versions and pool=1."""
from concurrent.futures import ThreadPoolExecutor
import json
import logging
import os
from pathlib import Path
import secrets
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from app.core.config import database_url
from app.core.security import create_token
from app.models import Product, ProductSize
from app.schemas.catalog import ProductUpdate, ProductWrite
from app.schemas.inventory import SizeCreate, SizePatch
from app.seed import seed
from app.services import catalog, cart, inventory, orders
from app.services.unit_of_work import transaction

ROOT = Path(__file__).resolve().parent


def verify():
    name = 'transactions_check_' + uuid4().hex
    url = make_url(database_url())
    admin = create_engine(url.set(database='postgres'), isolation_level='AUTOCOMMIT', connect_args={'connect_timeout': 3})
    created = False
    engine = small = None
    checks = []
    def check(label, condition):
        assert condition, label
        checks.append(label)
    try:
        with admin.connect() as db:
            db.execute(text(f'CREATE DATABASE "{name}"'))
            created = True
        target = url.set(database=name)
        engine = create_engine(target, connect_args={'connect_timeout': 3})
        sessions = sessionmaker(engine)
        config = Config(str(ROOT / 'alembic.ini'))
        with engine.begin() as db:
            config.attributes['connection'] = db
            command.upgrade(config, 'head')
            command.check(config)
        seed(engine)
        with engine.begin() as db:
            for uid in (501, 502, 503):
                db.execute(text('INSERT INTO users(id,email,hashed_password,is_admin) VALUES(:id,:email,:hash,:admin)'),
                    dict(id=uid, email=f'fixture-{uid}@example.test', hash='disabled-fixture', admin=uid != 501))
        body = ProductWrite(name='Composed', brand_id=1, price='100.00')
        class Abort(Exception):
            pass
        try:
            with transaction(sessions=sessions) as db:
                product = catalog.create_product(db, body)
                variant = inventory.create_size(502, product.id, SizeCreate(size='44', stock=3), session=db)
                cart.add_item(501, variant.id, 1, session=db)
                orders.checkout(501, idempotency_key='rolled-back', session=db)
                raise Abort()
        except Abort:
            pass
        with engine.connect() as db:
            check('catalog inventory cart checkout share one rollback',
                db.scalar(select(Product.id).where(Product.name == 'Composed')) is None
                and all(db.scalar(text(f'SELECT count(*) FROM {table}')) == 0
                        for table in ('orders', 'order_items', 'cart_items', 'checkout_requests')))
            check('rollback preserves original stock', db.scalar(select(ProductSize.stock).where(ProductSize.id == 101)) == 3)
        with transaction(sessions=sessions) as db:
            product = catalog.create_product(db, body)
            variant = inventory.create_size(502, product.id, SizeCreate(size='44', stock=3), session=db)
        with engine.connect() as db:
            check('composed success commits both changes', db.scalar(select(ProductSize.stock).where(ProductSize.id == variant.id)) == 3)
        write = {**body.model_dump(mode='json'), 'version': product.version}
        with transaction(sessions=sessions) as db:
            first = catalog.update_product(db, product.id, ProductUpdate(**{**write, 'price': '200.00'}))
        try:
            with transaction(sessions=sessions) as db:
                catalog.update_product(db, product.id, ProductUpdate(**{**write, 'description': 'stale'}))
        except catalog.CatalogError as error:
            check('stale description rejects old price', error.status == 409 and error.message == 'product_version_conflict')
        else:
            raise AssertionError('Stale update accepted')
        with sessions() as db:
            current = catalog.get_product(db, product.id)
            check('winning price and version preserved', str(current.price) == '200.00' and current.description == '' and current.version == 2)
        try:
            with transaction(sessions=sessions) as db:
                catalog.update_product(db, product.id, ProductUpdate(**{**write, 'version': first.version, 'description': 'rollback'}))
                inventory.patch_size(502, product.id, variant.id, SizePatch(stock=0), session=db)
                raise Abort()
        except Abort:
            pass
        with sessions() as db:
            current = catalog.get_product(db, product.id)
            check('failed composition restores product version description and stock', current.version == first.version and current.description == ''
                  and db.get(ProductSize, variant.id).stock == 3)
        barrier = Barrier(2)
        def write_price(price):
            try:
                with transaction(sessions=sessions) as db:
                    barrier.wait(timeout=5)
                    catalog.update_product(db, product.id, ProductUpdate(**{**write, 'version': first.version, 'price': price}))
                return 200
            except catalog.CatalogError as error:
                return error.status
        with ThreadPoolExecutor(2) as pool:
            check('simultaneous version checks have exactly one winner', sorted(pool.map(write_price, ['300.00', '400.00'])) == [200, 409])
        small = create_engine(target, pool_size=1, max_overflow=0, pool_timeout=.5)
        small_sessions = sessionmaker(small)
        secret = secrets.token_urlsafe(48)
        with patch.dict(os.environ, {'JWT_SECRET': secret}):
            from app.final_main import app
            from app.core.request_logging import LOGGER_NAME
            logging.getLogger(LOGGER_NAME).setLevel(logging.WARNING)
        headers = {uid: {'Authorization': 'Bearer ' + create_token(uid, secret)} for uid in (501, 502)}
        with patch('app.database.SessionLocal', small_sessions), \
             patch('app.dependencies.SessionLocal', small_sessions), \
             patch('app.services.unit_of_work.SessionLocal', small_sessions), \
             TestClient(app) as client:
            app.state.jwt_secret = secret
            check('pool=1 authenticated profile', client.get('/auth/me', headers=headers[501]).status_code == 200)
            check('pool=1 inventory write', client.patch(f'/products/{product.id}/sizes/{variant.id}', headers=headers[502], json={'stock': 4}).status_code == 200)
            current = client.get(f'/products/{product.id}').json()
            update = {**write, 'version': current['version'], 'price': '500.00'}
            check('pool=1 catalog write', client.put(f'/products/{product.id}', headers=headers[502], json=update).status_code == 200)
            check('HTTP stale version rejected', client.put(f'/products/{product.id}', headers=headers[502], json=update).status_code == 409)
            update.pop('version')
            check('HTTP version required', client.put(f'/products/{product.id}', headers=headers[502], json=update).status_code == 422)
            check('pool=1 cart write', client.post('/cart/items', headers=headers[501], json={'product_size_id': variant.id, 'quantity': 1}).status_code == 200)
            purchase = client.post('/orders', headers={**headers[501], 'Idempotency-Key': 'pool-one'}, json={})
            check('pool=1 checkout', purchase.status_code == 201)
            check('pool=1 idempotent replay', client.post('/orders', headers={**headers[501], 'Idempotency-Key': 'pool-one'}, json={}).json() == purchase.json())
            check('pool=1 order status', client.patch(f'/orders/{purchase.json()["id"]}/status', headers=headers[502], json={'status': 'processing'}).status_code == 200)
            def read(_):
                return client.get('/cart', headers=headers[501]).status_code
            with ThreadPoolExecutor(4) as pool:
                check('concurrent authenticated requests complete with pool=1', list(pool.map(read, range(12))) == [200] * 12)
            check('connections returned after success and errors', small.pool.checkedout() == 0)
        return checks
    finally:
        for item in (small, engine):
            if item is not None:
                item.dispose()
        if created:
            with admin.connect() as db:
                db.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()


if __name__ == '__main__':
    result = verify()
    print(json.dumps({'checks': result, 'count': len(result), 'cleanup': 'disposable database removed'}, ensure_ascii=False))
