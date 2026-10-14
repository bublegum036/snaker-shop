"""Add purchase-time names and sizes; historical values remain unknown."""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    # No backfill from today's catalog: that would invent historical data.
    op.add_column('order_items', sa.Column('name_at_purchase', sa.Text(), nullable=True))
    op.add_column('order_items', sa.Column('size_at_purchase', sa.Numeric(4, 1), nullable=True))
    op.create_check_constraint('ck_item_snapshot_size', 'order_items', 'size_at_purchase > 0')
    op.create_check_constraint('ck_item_snapshot_pair', 'order_items',
        '(name_at_purchase IS NULL) = (size_at_purchase IS NULL)')


def downgrade():
    # Orders/prices survive, but these two snapshot values are discarded.
    op.drop_constraint('ck_item_snapshot_pair', 'order_items', type_='check')
    op.drop_constraint('ck_item_snapshot_size', 'order_items', type_='check')
    op.drop_column('order_items', 'size_at_purchase')
    op.drop_column('order_items', 'name_at_purchase')
