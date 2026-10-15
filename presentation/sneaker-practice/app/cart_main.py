"""M4 checkpoint: M3 plus the current user's cart."""
from app.store_main import create_store_app
from app.routers.cart import router

def create_cart_app():
    app = create_store_app()
    app.title = 'Sneaker Shop · M4'
    app.include_router(router)
    return app

app = create_cart_app()
