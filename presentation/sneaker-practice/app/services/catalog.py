from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from app.models import Brand, Product, ProductSize
from app.schemas.catalog import ProductRead

class CatalogError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message

def list_products(db, *, brand_id=None, min_price=None, max_price=None, size=None, search=None, limit=20, offset=0):
    if min_price is not None and max_price is not None and min_price > max_price:
        raise CatalogError(422, 'min_price must not exceed max_price')
    query = select(Product).options(selectinload(Product.sizes))
    if brand_id is not None:
        query = query.where(Product.brand_id == brand_id)
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)
    if size is not None:
        query = query.where(Product.sizes.any((ProductSize.size == size) & (ProductSize.stock > 0)))
    if search is not None:
        query = query.where(Product.name.icontains(search.strip(), autoescape=True))
    return list(db.scalars(query.order_by(Product.id).limit(limit).offset(offset)))

def get_product(db, product_id):
    product = db.scalar(select(Product).options(selectinload(Product.sizes)).where(Product.id == product_id))
    if product is None:
        raise CatalogError(404, 'Product not found')
    return product

def product_values(body):
    values = body.model_dump(exclude={'version'})
    if values['image_url'] is not None:
        values['image_url'] = str(values['image_url'])
    return values

def check_brand(db, brand_id):
    if db.get(Brand, brand_id) is None:
        raise CatalogError(409, 'Brand does not exist')

def flush(db):
    try:
        db.flush()
    except IntegrityError as error:
        if getattr(error.orig, 'sqlstate', None) in {'23503','23505','23514'}:
            raise CatalogError(409, 'Change conflicts with catalog data') from None
        raise

def create_product(db, body):
    check_brand(db, body.brand_id)
    product = Product(**product_values(body))
    db.add(product)
    flush(db)
    return ProductRead.model_validate(get_product(db, product.id))

def update_product(db, product_id, body):
    product = get_product(db, product_id)
    check_brand(db, body.brand_id)
    # Compare-and-swap in one SQL statement: simultaneous writers cannot both win.
    changed = db.execute(update(Product).where(
        Product.id == product_id, Product.version == body.version
    ).values(**product_values(body), version=Product.version + 1)
      .execution_options(synchronize_session=False))
    if changed.rowcount != 1:
        raise CatalogError(409, 'product_version_conflict')
    db.expire(product)
    return ProductRead.model_validate(get_product(db, product_id))

def delete_product(db, product_id):
    get_product(db, product_id)
    try:
        # FK constraints preserve cart/order references; both deletions are atomic.
        db.execute(delete(ProductSize).where(ProductSize.product_id == product_id))
        db.execute(delete(Product).where(Product.id == product_id))
        db.flush()
    except IntegrityError as error:
        if getattr(error.orig, 'sqlstate', None) == '23503':
            raise CatalogError(409, 'Product is referenced by a cart or order') from None
        raise
