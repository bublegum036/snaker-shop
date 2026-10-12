from alembic import context
from app.database import make_engine
from app.models import Base
from app.core.config import database_url

config = context.config
target_metadata = Base.metadata

def migrate(connection):
    context.configure(connection=connection, target_metadata=target_metadata,
                      compare_type=True, compare_server_default=True)
    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    context.configure(url=database_url(), target_metadata=target_metadata,
                      literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    connection = config.attributes.get("connection")
    if connection is not None:
        migrate(connection)
    else:
        engine = make_engine()
        try:
            with engine.connect() as connection:
                migrate(connection)
        finally:
            engine.dispose()
