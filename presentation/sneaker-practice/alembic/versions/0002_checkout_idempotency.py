"""Persist successful checkout responses without modifying existing shop data."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'checkout_requests',
        sa.Column('id', sa.Integer(), sa.Identity(always=False), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(128), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('response', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.UniqueConstraint('user_id', 'key', name='uq_checkout_request_user_key'),
        sa.CheckConstraint("key ~ '^[A-Za-z0-9._:-]{1,128}$'", name='ck_checkout_request_key'),
    )


def downgrade():
    # Orders survive, but replay protection for their old keys is lost.
    op.drop_table('checkout_requests')
