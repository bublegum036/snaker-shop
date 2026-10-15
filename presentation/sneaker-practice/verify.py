"""M1 acceptance in a newly created, disposable PostgreSQL database."""
import json
from pathlib import Path
from uuid import uuid4
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import database_url
from app.database import make_engine
from app.models import Base, Brand, Product, ProductSize, User, CartItem, Order, OrderItem
from app.seed import seed

ROOT = Path(__file__).resolve().parent

def verify():
    name = 'm01_check_' + uuid4().hex
    url = make_url(database_url())
    admin = create_engine(url.set(database='postgres'), isolation_level='AUTOCOMMIT', connect_args={'connect_timeout': 3})
    engine = None
    created = False
    checks = []
    report = {}
    def check(label, condition):
        assert condition, label
        checks.append(label)
    try:
        with admin.connect() as connection:
            # This name is generated here from UUID hex, not from external input.
            connection.execute(text(f'CREATE DATABASE "{name}"'))
            created = True
        engine = make_engine(url.set(database=name))
        check('new database has no application tables', inspect(engine).get_table_names() == [])
        config = Config(str(ROOT / 'alembic.ini'))
        with engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, 'head')
        check('migration creates eight tables and alembic_version', set(inspect(engine).get_table_names()) == set(Base.metadata.tables) | {'alembic_version'})
        with engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, 'head')
            command.check(config)
            check('migration reaches 0004 and repeats safely', connection.scalar(text('SELECT version_num FROM alembic_version')) == '0004')
        checks.append('alembic check finds no pending model changes')
        inspector = inspect(engine)
        check('nine foreign keys exist', sum(len(inspector.get_foreign_keys(t)) for t in Base.metadata.tables) == 9)
        price = next(c for c in inspector.get_columns('products') if c['name'] == 'price')
        check('price is non-null numeric(10,2)', not price['nullable'] and price['type'].precision == 10 and price['type'].scale == 2)
        check('image_url is nullable', next(c for c in inspector.get_columns('products') if c['name'] == 'image_url')['nullable'])
        seed(engine)
        def snapshot():
            with engine.connect() as connection:
                return {t: [dict(row) for row in connection.execute(select(Base.metadata.tables[t]).order_by(Base.metadata.tables[t].c.id)).mappings()] for t in Base.metadata.tables}
        first = snapshot()
        report['counts'] = {t: len(rows) for t, rows in first.items()}
        check('catalog seed counts 2 / 3 / 4 and no accounts or purchases', report['counts'] == {'users': 0, 'brands': 2, 'products': 3, 'product_sizes': 4, 'cart_items': 0, 'orders': 0, 'order_items': 0, 'checkout_requests': 0})
        seed(engine)
        check('second seed preserves all row values', snapshot() == first)
        with engine.begin() as connection:
            connection.execute(text('UPDATE product_sizes SET stock=2 WHERE id=101'))
        seed(engine)
        with engine.connect() as connection:
            check('repeat seed does not reset edited stock', connection.scalar(text('SELECT stock FROM product_sizes WHERE id=101')) == 2)
        with Session(engine) as session:
            product = session.get(Product, 10)
            report['relationship'] = {'product': product.name, 'brand': product.brand.name, 'sizes': sorted(str(s.size) for s in product.sizes)}
            check('ORM relationships load brand and two sizes', report['relationship'] == {'product': 'North Runner', 'brand': 'North', 'sizes': ['42.0', '43.0']})
        with engine.connect() as connection:
            transaction = connection.begin()
            connection.execute(text("INSERT INTO users(id,email,hashed_password) VALUES(7,'fixture@example.test','test-only-disabled')"))
            connection.execute(text("INSERT INTO orders(id,user_id,total) VALUES(501,7,7990)"))
            connection.execute(text('INSERT INTO cart_items(user_id,product_size_id,quantity) VALUES(7,101,1)'))
            cases = [
                ('negative price', "INSERT INTO products(name,brand_id,price) VALUES('Bad',1,-1)", '23514'),
                ('unknown brand', "INSERT INTO products(name,brand_id,price) VALUES('Bad',999,1)", '23503'),
                ('null product name', 'INSERT INTO products(name,brand_id,price) VALUES(NULL,1,1)', '23502'),
                ('negative stock', 'UPDATE product_sizes SET stock=-1 WHERE id=101', '23514'),
                ('duplicate product size', 'INSERT INTO product_sizes(product_id,size,stock) VALUES(10,42,1)', '23505'),
                ('zero cart quantity', 'UPDATE cart_items SET quantity=0 WHERE user_id=7', '23514'),
                ('duplicate cart position', 'INSERT INTO cart_items(user_id,product_size_id,quantity) VALUES(7,101,2)', '23505'),
                ('unknown cart owner', 'INSERT INTO cart_items(user_id,product_size_id,quantity) VALUES(999,101,1)', '23503'),
                ('negative order total', 'UPDATE orders SET total=-1 WHERE id=501', '23514'),
                ('invalid order status', "UPDATE orders SET status='anything' WHERE id=501", '23514'),
                ('zero order quantity', 'INSERT INTO order_items(order_id,product_size_id,quantity,price_at_purchase) VALUES(501,101,0,7990)', '23514'),
                ('negative snapshot price', 'INSERT INTO order_items(order_id,product_size_id,quantity,price_at_purchase) VALUES(501,101,1,-1)', '23514'),
            ]
            report['constraints'] = []
            for label, statement, expected in cases:
                savepoint = connection.begin_nested()
                try:
                    connection.execute(text(statement))
                except IntegrityError as error:
                    state = error.orig.sqlstate
                    savepoint.rollback()
                    check(label, state == expected)
                    report['constraints'].append({'case': label, 'sqlstate': state})
                else:
                    savepoint.rollback()
                    raise AssertionError(f'Constraint accepted: {label}')
            new_id = connection.scalar(text("INSERT INTO products(name,brand_id,price) VALUES('Generated ID',1,1) RETURNING id"))
            check('seed advances identity beyond fixed IDs', new_id > 30)
            transaction.rollback()
        check('constraint fixtures rolled back', snapshot()['users'] == [] and snapshot()['orders'] == [])
        report.update(checks=checks, database='new disposable database', revision='0004')
    finally:
        if engine is not None:
            engine.dispose()
        if created:
            with admin.connect() as connection:
                connection.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()
    serialized = json.dumps(report, ensure_ascii=False, indent=2)
    (ROOT/'verification.json').write_text(serialized+'\n')
    (ROOT/'verified.js').write_text('window.SNEAKER_M01 = '+serialized+';\n')
    print(f'Verified {len(checks)} M1 checks; temporary database removed.')

if __name__ == '__main__':
    verify()
