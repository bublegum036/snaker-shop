"""Idempotent classroom fixture: inserts missing rows, preserves existing rows."""
import json
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from models import Base
from security import hash_password

PASSWORDS = {7:'Anya-demo-A7!', 8:'Boris-demo-B8!', 9:'Admin-demo-C9!'}

def seed(engine):
    tables = json.loads((Path(__file__).resolve().parent.parent/'sneaker-db-examples/verification.json').read_text())['tables']
    with engine.begin() as conn:
        for name in ['users','brands','products','product_sizes','cart_items','orders','order_items']:
            rows = [dict(row) for row in tables[name]]
            if name == 'users':
                for row in rows:
                    row['hashed_password'] = hash_password(PASSWORDS[row['id']])
            if name == 'orders':
                for row in rows:
                    row['created_at'] = '2026-10-01T12:00:00Z'
            conn.execute(insert(Base.metadata.tables[name]).values(rows).on_conflict_do_nothing())
            # Table names are an internal allowlist; never interpolated user input.
            # Never move an already used identity sequence backwards on a repeat run.
            seq = conn.scalar(text('SELECT pg_get_serial_sequence(:table_name, :column_name)'), {'table_name':name,'column_name':'id'})
            conn.execute(text(f"SELECT setval(:seq, GREATEST(COALESCE((SELECT MAX(id) FROM {name}), 1), nextval(:seq)), true)"), {'seq':seq})

if __name__ == '__main__':
    from database import make_engine
    engine = make_engine()
    seed(engine)
    engine.dispose()
    print('Seed complete: existing rows preserved.')
