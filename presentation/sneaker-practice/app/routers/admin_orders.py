from typing import Annotated
from fastapi import APIRouter, Depends, Query
from app.dependencies import require_admin
from app.models import User
from app.routers.catalog import PositiveID
from app.schemas.orders import OrderRead, OrderStatus
from app.services import orders

router = APIRouter(prefix='/admin/orders', tags=['Orders · admin'])
Admin = Annotated[User, Depends(require_admin)]


@router.get('', response_model=list[OrderRead])
def history(admin: Admin, limit: Annotated[int, Query(ge=1, le=100)] = 20,
            offset: Annotated[int, Query(ge=0)] = 0,
            status: Annotated[OrderStatus | None, Query()] = None):
    return orders.list_admin_orders(admin.id, limit=limit, offset=offset, status=status)


@router.get('/{order_id}', response_model=OrderRead)
def detail(order_id: PositiveID, admin: Admin):
    return orders.get_admin_order(admin.id, order_id)
