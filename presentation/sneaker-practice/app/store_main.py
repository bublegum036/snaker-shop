"""M3 checkpoint: catalog writes are protected by real user/admin checks."""
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.catalog_main import create_app
from app.services.unit_of_work import ShopError
from app.core.config import jwt_secret
from app.routers.auth import router as auth_router
from app.routers.catalog_write import router as write_router

async def validation_error(request: Request, error: RequestValidationError):
    # Never echo passwords, token input or other submitted values in errors.
    details = [{k: item[k] for k in ('loc','msg','type')} for item in error.errors()]
    return JSONResponse(status_code=422, content={'detail': details})


def create_store_app():
    app = create_app()
    app.title = 'Sneaker Shop · M3'
    app.state.jwt_secret = jwt_secret()
    app.include_router(auth_router)
    app.include_router(write_router)
    
    @app.exception_handler(ShopError)
    async def shop_error(request: Request, error: ShopError):
        headers = {'WWW-Authenticate': 'Bearer'} if error.status == 401 else None
        return JSONResponse(status_code=error.status, content={'detail': error.reason}, headers=headers)

    app.add_exception_handler(RequestValidationError, validation_error)
    return app

app = create_store_app()
