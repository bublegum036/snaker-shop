"""M4 checkpoint: M3 plus the current user's cart."""
from fastapi import Request
from fastapi.responses import JSONResponse
from app.store_main import create_store_app
from app.routers.cart import router
from app.services.unit_of_work import ShopError

def create_cart_app():
    app = create_store_app()
    app.title = 'Sneaker Shop · M4'
    app.include_router(router)
    @app.exception_handler(ShopError)
    async def shop_error(request: Request, error: ShopError):
        headers = {'WWW-Authenticate':'Bearer'} if error.status == 401 else None
        return JSONResponse(status_code=error.status, content={'detail':error.reason}, headers=headers)
    return app

app = create_cart_app()
