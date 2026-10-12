from typing import Annotated
from fastapi import APIRouter, Depends, Query
from app.dependencies import require_admin
from app.models import User
from app.routers.cart import CurrentUser
from app.routers.catalog import PositiveID
from app.schemas.orders import CheckoutRequest, StatusUpdate, OrderRead
from app.services import orders

router = APIRouter(prefix='/orders', tags=['Orders'])

@router.post('', status_code=201, response_model=OrderRead)
def checkout(user: CurrentUser, body: CheckoutRequest | None = None):
    return orders.checkout(user.id)

@router.get('', response_model=list[OrderRead])
def history(user: CurrentUser, limit: Annotated[int, Query(ge=1,le=100)] = 20,
            offset: Annotated[int, Query(ge=0)] = 0):
    return orders.list_orders(user.id, limit=limit, offset=offset)

@router.get('/{order_id}', response_model=OrderRead)
def detail(order_id: PositiveID, user: CurrentUser):
    return orders.get_order(user.id, order_id)

@router.patch('/{order_id}/status', response_model=OrderRead)
def status(order_id: PositiveID, body: StatusUpdate, admin: Annotated[User, Depends(require_admin)]):
    return orders.change_status(admin.id, order_id, body.status)
