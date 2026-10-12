from decimal import Decimal
from typing import Annotated
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_session
from app.models import Brand
from app.schemas.catalog import BrandRead, ProductRead
from app.services import catalog

router = APIRouter(tags=['Catalog'])
Db = Annotated[Session, Depends(get_session)]
PositiveID = Annotated[int, Path(gt=0, le=2147483647)]

@router.get('/brands', response_model=list[BrandRead])
def brands(db: Db):
    return list(db.scalars(select(Brand).order_by(Brand.id)))

@router.get('/products', response_model=list[ProductRead])
def products(
    db: Db,
    brand_id: Annotated[int | None, Query(gt=0, le=2147483647)] = None,
    min_price: Annotated[Decimal | None, Query(ge=0, allow_inf_nan=False)] = None,
    max_price: Annotated[Decimal | None, Query(ge=0, allow_inf_nan=False)] = None,
    size: Annotated[Decimal | None, Query(gt=0, le=999, decimal_places=1, allow_inf_nan=False)] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return catalog.list_products(db, brand_id=brand_id, min_price=min_price, max_price=max_price,
                                 size=size, search=search, limit=limit, offset=offset)

@router.get('/products/{product_id}', response_model=ProductRead)
def product(product_id: PositiveID, db: Db):
    return catalog.get_product(db, product_id)
