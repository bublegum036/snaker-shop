"""Приложение к главам 3–4: проверка данных без базы, JWT и записи заказов.

Запуск из этой папки: python -m uvicorn demo:app --reload --port 8000
Учебные /demo/* не являются контрактом будущего магазина.
"""
from fastapi import Depends, FastAPI, Query, Request
from routers import catalog
from schemas import CartItemCreate, ProductCreate, ProductRead, UserRead

app = FastAPI(title="Учебные примеры — главы 3 и 4")
app.state.cart_handler_calls = 0
app.include_router(catalog.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/demo/cart/items", response_model=CartItemCreate)
def validate_cart(item: CartItemCreate, request: Request):
    # Только счётчик вызовов для проверки; корзина никуда не сохраняется.
    request.app.state.cart_handler_calls += 1
    return item


@app.get("/demo/user", response_model=UserRead)
def example_user():
    return {
        "id": 7,
        "email": "anya@example.com",
        "hashed_password": "NOT_A_REAL_HASH",
    }


@app.post("/demo/products", response_model=ProductRead, status_code=201)
def example_product(data: ProductCreate):
    # ID фиксирован для иллюстрации. Реальной вставки в БД здесь нет.
    return ProductRead(id=10, **data.model_dump())


def page_size(limit: int = Query(10, ge=1, le=50)):
    return limit


@app.get("/demo/page")
def page(limit: int = Depends(page_size)):
    return {"limit": limit}
