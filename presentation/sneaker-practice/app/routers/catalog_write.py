from typing import Annotated
from fastapi import APIRouter, Depends, Response
from app.dependencies import require_admin
from app.routers.catalog import PositiveID
from app.schemas.catalog import ProductWrite, ProductUpdate, ProductRead
from app.services import catalog
from app.schemas.auth import UserRead
from app.services.unit_of_work import transaction, require_admin as check_admin

router = APIRouter(tags=['Catalog · admin'])
Admin = Annotated[UserRead, Depends(require_admin)]

@router.post('/products', status_code=201, response_model=ProductRead)
def create(body: ProductWrite, admin: Admin):
    with transaction() as db:
        check_admin(db, admin.id)
        return catalog.create_product(db, body)

@router.put('/products/{product_id}', response_model=ProductRead)
def update(product_id: PositiveID, body: ProductUpdate, admin: Admin):
    with transaction() as db:
        check_admin(db, admin.id)
        return catalog.update_product(db, product_id, body)

@router.delete('/products/{product_id}', status_code=204)
def delete(product_id: PositiveID, admin: Admin):
    with transaction() as db:
        check_admin(db, admin.id)
        catalog.delete_product(db, product_id)
    return Response(status_code=204)
