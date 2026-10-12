"""M2 checkpoint: only public reads, with no mutation routes registered."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.main import health, lifespan
from app.routers.catalog import router
from app.services.catalog import CatalogError


def create_app():
    app = FastAPI(title='Sneaker Shop · M2', lifespan=lifespan)
    app.add_api_route('/health', health, methods=['GET'])
    app.include_router(router)
    @app.exception_handler(CatalogError)
    async def catalog_error(request: Request, error: CatalogError):
        return JSONResponse(status_code=error.status, content={'detail': error.message})
    return app

app = create_app()
