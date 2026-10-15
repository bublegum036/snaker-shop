from decimal import Decimal
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload
from app.models import CartItem, ProductSize, Product, Order, OrderItem, CheckoutRequestRecord
from app.schemas.orders import OrderRead, OrderItemRead
from app.services.unit_of_work import ShopError, transaction, require_admin


def dto(order):
    return OrderRead(id=order.id, user_id=order.user_id, status=order.status,
        total=order.total, created_at=order.created_at,
        items=[OrderItemRead.model_validate(item) for item in sorted(order.items, key=lambda x:x.id)])

def checkout(user_id, *, idempotency_key=None, sessions=None, session=None, _test_hook=None):
    """Hook is an internal Python test seam; no HTTP input can select it."""
    def stage(name, db):
        if _test_hook is not None:
            _test_hook(name, db)
    with transaction(owner_id=user_id, sessions=sessions, session=session) as db:
        # The owner's FOR UPDATE lock serializes both retries and cart changes.
        # Replay BEFORE reading the cart: a retry must never buy a new cart.
        if idempotency_key is not None:
            previous = db.scalar(select(CheckoutRequestRecord).where(
                CheckoutRequestRecord.user_id == user_id,
                CheckoutRequestRecord.key == idempotency_key,
            ))
            if previous is not None:
                return OrderRead.model_validate(previous.response)
        cart = list(db.scalars(select(CartItem).where(CartItem.user_id == user_id).order_by(CartItem.product_size_id)))
        if not cart:
            raise ShopError(409, 'empty_cart')
        sizes = {}
        for item in cart:
            size = db.scalar(select(ProductSize).where(ProductSize.id == item.product_size_id).with_for_update())
            if size is None:
                raise ShopError(409, 'size_unavailable')
            sizes[size.id] = size
        prices = {}
        names = {}
        for product_id in sorted({size.product_id for size in sizes.values()}):
            product = db.scalar(select(Product).where(Product.id == product_id).with_for_update(read=True))
            if product is None:
                raise ShopError(409, 'product_unavailable')
            prices[product_id] = product.price
            names[product_id] = product.name
        for item in cart:
            if item.quantity <= 0 or item.quantity > sizes[item.product_size_id].stock:
                raise ShopError(409, 'insufficient_stock')
        total = sum((prices[sizes[item.product_size_id].product_id] * item.quantity for item in cart), Decimal('0.00'))
        if total > Decimal('9999999999.99'):
            raise ShopError(409, 'order_total_too_large')
        order = Order(user_id=user_id, status='created', total=total)
        db.add(order)
        db.flush()
        stage('after_order', db)
        for index, item in enumerate(cart):
            size = sizes[item.product_size_id]
            db.add(OrderItem(order_id=order.id, product_size_id=size.id,
                quantity=item.quantity, price_at_purchase=prices[size.product_id],
                name_at_purchase=names[size.product_id], size_at_purchase=size.size))
            size.stock -= item.quantity
            db.flush()
            if index == 0:
                stage('after_first_stock', db)
        db.execute(delete(CartItem).where(CartItem.user_id == user_id))
        db.flush()
        stage('after_cart_delete', db)
        result = dto(order)
        if idempotency_key is not None:
            db.add(CheckoutRequestRecord(
                user_id=user_id, key=idempotency_key, order_id=order.id,
                response=result.model_dump(mode='json'),
            ))
            db.flush()
            stage('after_idempotency_record', db)
    # Standalone calls have committed; joined calls leave commit to the outer owner.
    return result

def list_orders(user_id, *, limit=20, offset=0, sessions=None, session=None):
    with transaction(sessions=sessions, session=session) as db:
        rows = db.scalars(select(Order).where(Order.user_id == user_id)
            .options(selectinload(Order.items)).order_by(Order.id.desc()).limit(limit).offset(offset))
        result = [dto(order) for order in rows]
    return result

def get_order(user_id, order_id, *, sessions=None, session=None):
    with transaction(sessions=sessions, session=session) as db:
        order = db.scalar(select(Order).where(Order.id == order_id, Order.user_id == user_id)
            .options(selectinload(Order.items)))
        if order is None:
            raise ShopError(404, 'order_not_found')
        result = dto(order)
    return result

def change_status(admin_id, order_id, status, *, sessions=None, session=None):
    with transaction(sessions=sessions, session=session) as db:
        # Recheck the role in the writing transaction; keep it stable until commit.
        require_order_admin(db, admin_id)
        order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
        if order is None:
            raise ShopError(404, 'order_not_found')
        transitions = {'created': 'processing', 'processing': 'completed'}
        if status != order.status and transitions.get(order.status) != status:
            raise ShopError(409, 'invalid_status_transition')
        order.status = status
        db.flush()
        result = dto(order)
    return result


# Kept as an alias for existing instructional callers.
require_order_admin = require_admin

def list_admin_orders(admin_id, *, limit=20, offset=0, status=None, sessions=None, session=None):
    with transaction(sessions=sessions, session=session) as db:
        require_order_admin(db, admin_id)
        query = select(Order).options(selectinload(Order.items)).order_by(Order.id.desc())
        if status is not None:
            query = query.where(Order.status == status)
        return [dto(order) for order in db.scalars(query.limit(limit).offset(offset))]


def get_admin_order(admin_id, order_id, *, sessions=None, session=None):
    with transaction(sessions=sessions, session=session) as db:
        require_order_admin(db, admin_id)
        order = db.scalar(select(Order).where(Order.id == order_id).options(selectinload(Order.items)))
        if order is None:
            raise ShopError(404, 'order_not_found')
        return dto(order)
