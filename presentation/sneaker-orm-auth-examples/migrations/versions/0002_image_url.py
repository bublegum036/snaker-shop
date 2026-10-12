"""Add optional product image URL."""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('products', sa.Column('image_url', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('products', 'image_url')
