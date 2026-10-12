from fastapi import APIRouter, HTTPException
from schemas import ProductRead
from services import list_products

router = APIRouter(prefix="/products", tags=["Каталог"])


@router.get("", response_model=list[ProductRead])
def catalog():
    return list_products()


@router.get("/{product_id}", response_model=ProductRead)
def product(product_id: int):
    for item in list_products():
        if item["id"] == product_id:
            return item
    raise HTTPException(status_code=404, detail="Товар не найден")
