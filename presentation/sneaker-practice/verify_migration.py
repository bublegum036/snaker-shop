"""Upgrade/downgrade preservation checks ONLY in verify_final's disposable DB."""
import os
from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from app.database import engine
from app.models import Base
from app.seed import seed


def verify():
    if os.getenv('SNEAKER_FINAL_DISPOSABLE') != 'yes':
        raise SystemExit('Run verify_final.py; migration checks require its disposable database.')
    tables = {name: table for name, table in Base.metadata.tables.items() if name != 'checkout_requests'}

    def snapshot():
        with engine.connect() as db:
            return {name: [tuple(row) for row in db.execute(select(*[column for column in table.c
                        if column.name not in {'name_at_purchase', 'size_at_purchase', 'version'}]).order_by(table.c.id))]
                    for name, table in tables.items()}

    with engine.connect() as db:
        assert db.scalar(text('SELECT version_num FROM alembic_version')) == '0001'
    seed(engine)
    with engine.begin() as db:
        db.execute(text("INSERT INTO users(id,email,hashed_password) VALUES(501,'migration@example.test','disabled-test-fixture')"))
        db.execute(text('INSERT INTO orders(id,user_id,total) VALUES(501,501,7990)'))
        db.execute(text('INSERT INTO order_items(id,order_id,product_size_id,quantity,price_at_purchase) VALUES(501,501,101,1,7990)'))
        db.execute(text('INSERT INTO cart_items(id,user_id,product_size_id,quantity) VALUES(501,501,201,1)'))
    before = snapshot()
    config = Config('alembic.ini')
    command.upgrade(config, 'head')
    assert snapshot() == before
    with engine.connect() as db:
        assert db.scalar(text('SELECT count(*) FROM checkout_requests')) == 0
        assert db.scalar(text('SELECT version_num FROM alembic_version')) == '0004'
    command.downgrade(config, '0001')
    assert snapshot() == before
    command.upgrade(config, 'head')
    command.check(config)
    assert snapshot() == before
    # Remove only the fixtures just inserted into this fresh, disposable database.
    with engine.begin() as db:
        for table in ['cart_items', 'order_items', 'orders', 'users']:
            db.execute(text(f'DELETE FROM {table} WHERE id=501'))
    engine.dispose()
    print('PASS migrations preserve original columns in all seven shop tables through upgrade, downgrade and upgrade')


if __name__ == '__main__':
    verify()
