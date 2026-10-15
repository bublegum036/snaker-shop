import { routerTexts as text } from './router.texts'
import { createRouter, createWebHistory } from 'vue-router'
import CatalogView from '@/views/CatalogView/CatalogView.vue'
import AuthView from '@/views/AuthView/AuthView.vue'
import AccountView from '@/views/AccountView/AccountView.vue'
import CartView from '@/views/CartView/CartView.vue'
import OrdersView from '@/views/OrdersView/OrdersView.vue'
import OrderDetailsView from '@/views/OrderDetailsView/OrderDetailsView.vue'
import AdminProductsView from '@/views/AdminProductsView/AdminProductsView.vue'
import AdminInventoryView from '@/views/AdminInventoryView/AdminInventoryView.vue'
import { sessionGuard } from './session-guard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'catalog', component: CatalogView },
    { path: '/login', name: 'login', component: AuthView, props: { mode: 'login' }, meta: { guestOnly: true } },
    { path: '/register', name: 'register', component: AuthView, props: { mode: 'register' }, meta: { guestOnly: true } },
    { path: '/admin/products/:productId/inventory', name: 'admin-inventory', component: AdminInventoryView, props: (route) => ({ productId: String(route.params.productId) }), meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/products', name: 'admin-products', component: AdminProductsView, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/account', name: 'account', component: AccountView, meta: { requiresAuth: true } },
    { path: '/orders', name: 'orders', component: OrdersView, meta: { requiresAuth: true } },
    { path: '/orders/:orderId', name: 'order-details', component: OrderDetailsView, props: (route) => ({ orderId: String(route.params.orderId) }), meta: { requiresAuth: true } },
    { path: '/cart', name: 'cart', component: CartView, meta: { requiresAuth: true } },
  ],
})

router.beforeEach(sessionGuard)

router.afterEach((to) => {
  document.title = text.pageTitle(String(to.name))
})

export default router
