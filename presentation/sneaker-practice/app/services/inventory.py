"""Admin inventory writes coordinated with cart and checkout row locks."""
from contextlib import contextmanager
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import Product, ProductSize, CartItem, OrderItem
from app.schemas.catalog import SizeRead
from app.services.unit_of_work import ShopError, transaction, require_admin


@contextmanager
def admin_transaction(admin_id, *, sessions=None, session=None):
    try:
        with transaction(sessions=sessions, session=session) as db:
            require_admin(db, admin_id)
            yield db
    except IntegrityError as error:
        # Owned contexts have rolled back; joined failures must escape to the owner.
        reason = {
            '23505': 'size_already_exists',
            '23503': 'size_referenced',
            '23514': 'invalid_size_data',
        }.get(getattr(error.orig, 'sqlstate', None))
        if reason:
            raise ShopError(409, reason) from None
        raise


def lock_size(db, product_id, size_id):
    size = db.scalar(select(ProductSize).where(
        ProductSize.id == size_id, ProductSize.product_id == product_id
    ).with_for_update())
    if size is None:
        raise ShopError(404, 'size_not_found')
    return size


def referenced(db, size_id):
    return (
        db.scalar(select(CartItem.id).where(CartItem.product_size_id == size_id).limit(1)) is not None
        or db.scalar(select(OrderItem.id).where(OrderItem.product_size_id == size_id).limit(1)) is not None
    )


def create_size(admin_id, product_id, body, *, sessions=None, session=None):
    with admin_transaction(admin_id, sessions=sessions, session=session) as db:
        # A key-share lock keeps the parent present until the child is committed.
        product = db.scalar(select(Product.id).where(Product.id == product_id)
                            .with_for_update(read=True, key_share=True))
        if product is None:
            raise ShopError(404, 'product_not_found')
        size = ProductSize(product_id=product_id, **body.model_dump())
        db.add(size)
        db.flush()
        result = SizeRead.model_validate(size)
    return result


def patch_size(admin_id, product_id, size_id, body, *, sessions=None, session=None):
    with admin_transaction(admin_id, sessions=sessions, session=session) as db:
        size = lock_size(db, product_id, size_id)
        values = body.model_dump(exclude_unset=True)
        # Changing the variant identity would also change old cart/order references.
        if 'size' in values and values['size'] != size.size and referenced(db, size.id):
            raise ShopError(409, 'size_referenced')
        for field, value in values.items():
            setattr(size, field, value)
        db.flush()
        result = SizeRead.model_validate(size)
    return result


def delete_size(admin_id, product_id, size_id, *, sessions=None, session=None):
    with admin_transaction(admin_id, sessions=sessions, session=session) as db:
        size = lock_size(db, product_id, size_id)
        if referenced(db, size.id):
            raise ShopError(409, 'size_referenced')
        db.delete(size)
        db.flush()
