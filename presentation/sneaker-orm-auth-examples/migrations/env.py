from alembic import context
from database import make_engine
from models import Base

config = context.config

def migrate(connection):
    context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    raise RuntimeError('This isolated lesson uses online migrations only')
connection = config.attributes.get('connection')
if connection is not None:
    migrate(connection)
else:
    engine = make_engine()
    with engine.connect() as connection:
        migrate(connection)
    engine.dispose()
