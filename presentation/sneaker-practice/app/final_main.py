"""Final M0–M6 entry point; earlier checkpoints remain independently runnable."""
from app.cart_main import create_cart_app
from app.routers.orders import router as orders_router
from app.routers.inventory import router as inventory_router
from app.core.request_logging import configure_request_logging, RequestLoggingMiddleware

configure_request_logging()
app = create_cart_app()
app.title = "Sneaker Shop · M0–M6"
app.include_router(orders_router)
app.include_router(inventory_router)
app.add_middleware(RequestLoggingMiddleware)
