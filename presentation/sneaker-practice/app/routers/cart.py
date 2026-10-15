from typing import Annotated
from fastapi import APIRouter, Depends, Response
from app.schemas.auth import UserRead
from app.dependencies import get_current_user
from app.routers.catalog import PositiveID
from app.schemas.cart import CartAdd, Quantity, CartRead, CartItemRead
from app.services import cart

router = APIRouter(prefix='/cart', tags=['Cart · current user'])
CurrentUser = Annotated[UserRead, Depends(get_current_user)]

@router.get('', response_model=CartRead)
def get_cart(user: CurrentUser):
    return cart.get_cart(user.id)

@router.post('/items', response_model=CartItemRead)
def add(body: CartAdd, user: CurrentUser):
    return cart.add_item(user.id, body.product_size_id, body.quantity)

@router.patch('/items/{item_id}', response_model=CartItemRead)
def change(item_id: PositiveID, body: Quantity, user: CurrentUser):
    return cart.change_item(user.id, item_id, body.quantity)

@router.delete('/items/{item_id}', status_code=204)
def remove(item_id: PositiveID, user: CurrentUser):
    cart.remove_item(user.id, item_id)
    return Response(status_code=204)
