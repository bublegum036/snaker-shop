from fastapi import APIRouter, Depends, Response
from app.dependencies import require_admin
from app.routers.catalog import Db, PositiveID
from app.schemas.catalog import ProductWrite, ProductRead
from app.services import catalog

router = APIRouter(tags=['Catalog · admin'], dependencies=[Depends(require_admin)])

@router.post('/products', status_code=201, response_model=ProductRead)
def create(body: ProductWrite, db: Db):
    return catalog.create_product(db, body)

@router.put('/products/{product_id}', response_model=ProductRead)
def update(product_id: PositiveID, body: ProductWrite, db: Db):
    return catalog.update_product(db, product_id, body)

@router.delete('/products/{product_id}', status_code=204)
def delete(product_id: PositiveID, db: Db):
    catalog.delete_product(db, product_id)
    return Response(status_code=204)
