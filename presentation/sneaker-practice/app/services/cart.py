from decimal import Decimal
from sqlalchemy import select
from app.models import CartItem, ProductSize, Product
from app.schemas.cart import CartItemRead, CartRead
from app.services.unit_of_work import ShopError, transaction


def read_rows(db, user_id):
    rows = db.execute(select(CartItem, ProductSize, Product)
        .join(ProductSize, CartItem.product_size_id == ProductSize.id)
        .join(Product, ProductSize.product_id == Product.id)
        .where(CartItem.user_id == user_id).order_by(CartItem.id))
    return [CartItemRead(id=item.id, product_size_id=size.id, product_id=product.id,
        name=product.name, size=size.size, price=product.price, quantity=item.quantity,
        stock=size.stock, subtotal=product.price * item.quantity) for item, size, product in rows]

def own_item(db, user_id, item_id):
    item = db.scalar(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user_id))
    if item is None:
        raise ShopError(404, 'cart_item_not_found')
    return item

def lock_size(db, size_id):
    size = db.scalar(select(ProductSize).where(ProductSize.id == size_id).with_for_update())
    if size is None:
        raise ShopError(404, 'size_not_found')
    return size

def ensure_quantity(quantity, stock):
    if not 0 < quantity <= 2147483647:
        raise ShopError(422, 'invalid_quantity')
    if quantity > stock:
        raise ShopError(409, 'insufficient_stock')

def get_cart(user_id, *, sessions=None, session=None):
    with transaction(owner_id=user_id, sessions=sessions, session=session) as db:
        items = read_rows(db, user_id)
        result = CartRead(items=items, estimated_total=sum((i.subtotal for i in items), Decimal('0.00')))
    return result

def add_item(user_id, size_id, quantity, *, sessions=None, session=None):
    with transaction(owner_id=user_id, sessions=sessions, session=session) as db:
        size = lock_size(db, size_id)
        item = db.scalar(select(CartItem).where(CartItem.user_id == user_id, CartItem.product_size_id == size_id))
        new_quantity = (item.quantity if item else 0) + quantity
        if quantity <= 0:
            raise ShopError(422, 'invalid_quantity')
        ensure_quantity(new_quantity, size.stock)
        if item is None:
            item = CartItem(user_id=user_id, product_size_id=size_id, quantity=new_quantity)
            db.add(item)
        else:
            item.quantity = new_quantity
        db.flush()
        result = next(row for row in read_rows(db, user_id) if row.id == item.id)
    return result

def change_item(user_id, item_id, quantity, *, sessions=None, session=None):
    with transaction(owner_id=user_id, sessions=sessions, session=session) as db:
        item = own_item(db, user_id, item_id)
        size = lock_size(db, item.product_size_id)
        ensure_quantity(quantity, size.stock)
        item.quantity = quantity
        db.flush()
        result = next(row for row in read_rows(db, user_id) if row.id == item.id)
    return result

def remove_item(user_id, item_id, *, sessions=None, session=None):
    with transaction(owner_id=user_id, sessions=sessions, session=session) as db:
        db.delete(own_item(db, user_id, item_id))
