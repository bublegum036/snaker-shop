from typing import Annotated
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from app.dependencies import require_admin
from app.models import User
from app.routers.cart import CurrentUser
from app.routers.catalog import PositiveID
from app.schemas.orders import CheckoutRequest, StatusUpdate, OrderRead
from app.services import orders

router = APIRouter(prefix='/orders', tags=['Orders'])

@router.post('', status_code=201, response_model=OrderRead)
def checkout(
    user: CurrentUser,
    request: Request,
    body: CheckoutRequest | None = None,
    idempotency_key: Annotated[str | None, Header(
        alias='Idempotency-Key', min_length=1, max_length=128,
        pattern=r'^[A-Za-z0-9._:-]+$',
        description='One key per purchase; reuse on retry. Same user/key returns the original 201 response.',
    )] = None,
):
    if len(request.headers.getlist('idempotency-key')) > 1:
        raise HTTPException(422, 'Use a single Idempotency-Key header')
    return orders.checkout(user.id, idempotency_key=idempotency_key)

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
