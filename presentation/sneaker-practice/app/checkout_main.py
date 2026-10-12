"""M5 checkpoint: cart, atomic checkout, own history and admin status updates."""
from app.cart_main import create_cart_app
from app.routers.orders import router

app = create_cart_app()
app.title = 'Sneaker Shop · M5'
app.include_router(router)
