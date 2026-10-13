"""Final M0–M6 entry point; earlier checkpoints remain independently runnable."""
from app.cart_main import create_cart_app
from app.routers.orders import router as orders_router
from app.routers.inventory import router as inventory_router

app = create_cart_app()
app.title = "Sneaker Shop · M0–M6"
app.include_router(orders_router)
app.include_router(inventory_router)
