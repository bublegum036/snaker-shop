from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Identity, Integer, Numeric, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    email: Mapped[str] = mapped_column(Text, unique=True)
    hashed_password: Mapped[str] = mapped_column(Text)
    is_admin: Mapped[bool] = mapped_column(Boolean, server_default='false')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Brand(Base):
    __tablename__ = 'brands'
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    products: Mapped[list['Product']] = relationship(back_populates='brand')

class Product(Base):
    __tablename__ = 'products'
    __table_args__ = (CheckConstraint('price > 0', name='ck_products_price'),)
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    brand_id: Mapped[int] = mapped_column(ForeignKey('brands.id'))
    description: Mapped[str] = mapped_column(Text, server_default='')
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    image_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    brand: Mapped[Brand] = relationship(back_populates='products')

class ProductSize(Base):
    __tablename__ = 'product_sizes'
    __table_args__ = (UniqueConstraint('product_id', 'size', name='uq_product_size'), CheckConstraint('size > 0', name='ck_size_positive'), CheckConstraint('stock >= 0', name='ck_stock'))
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'))
    size: Mapped[Decimal] = mapped_column(Numeric(4, 1))
    stock: Mapped[int] = mapped_column(Integer)

class CartItem(Base):
    __tablename__ = 'cart_items'
    __table_args__ = (UniqueConstraint('user_id', 'product_size_id', name='uq_cart_size'), CheckConstraint('quantity > 0', name='ck_cart_quantity'))
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    product_size_id: Mapped[int] = mapped_column(ForeignKey('product_sizes.id'))
    quantity: Mapped[int] = mapped_column(Integer)

class Order(Base):
    __tablename__ = 'orders'
    __table_args__ = (CheckConstraint("status IN ('created','processing','completed')", name='ck_order_status'), CheckConstraint('total >= 0', name='ck_order_total'))
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    status: Mapped[str] = mapped_column(Text, server_default='created')
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class OrderItem(Base):
    __tablename__ = 'order_items'
    __table_args__ = (CheckConstraint('quantity > 0', name='ck_item_quantity'), CheckConstraint('price_at_purchase > 0', name='ck_item_price'))
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id'))
    product_size_id: Mapped[int] = mapped_column(ForeignKey('product_sizes.id'))
    quantity: Mapped[int] = mapped_column(Integer)
    price_at_purchase: Mapped[Decimal] = mapped_column(Numeric(10, 2))
