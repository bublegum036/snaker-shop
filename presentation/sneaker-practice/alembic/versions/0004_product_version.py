"""Version catalog forms to reject stale writes."""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    op.create_check_constraint('ck_product_version', 'products', 'version > 0')


def downgrade():
    op.drop_constraint('ck_product_version', 'products', type_='check')
    op.drop_column('products', 'version')
