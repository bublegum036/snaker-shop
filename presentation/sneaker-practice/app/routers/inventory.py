from typing import Annotated
from fastapi import APIRouter, Depends, Response
from app.schemas.auth import UserRead
from app.dependencies import require_admin
from app.routers.catalog import PositiveID
from app.schemas.catalog import SizeRead
from app.schemas.inventory import SizeCreate, SizePatch
from app.services import inventory

router = APIRouter(prefix='/products', tags=['Inventory · admin'])
Admin = Annotated[UserRead, Depends(require_admin)]


@router.post('/{product_id}/sizes', status_code=201, response_model=SizeRead)
def create(product_id: PositiveID, body: SizeCreate, admin: Admin):
    return inventory.create_size(admin.id, product_id, body)


@router.patch('/{product_id}/sizes/{size_id}', response_model=SizeRead)
def patch(product_id: PositiveID, size_id: PositiveID, body: SizePatch, admin: Admin):
    return inventory.patch_size(admin.id, product_id, size_id, body)


@router.delete('/{product_id}/sizes/{size_id}', status_code=204)
def delete(product_id: PositiveID, size_id: PositiveID, admin: Admin):
    inventory.delete_size(admin.id, product_id, size_id)
    return Response(status_code=204)
