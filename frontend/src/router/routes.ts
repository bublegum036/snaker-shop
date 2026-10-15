import type { RouteRecordRaw, RouterScrollBehavior } from 'vue-router'
import CatalogView from '@/views/CatalogView/CatalogView.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'catalog', component: CatalogView },
  { path: '/login', name: 'login', component: () => import('@/views/AuthView/AuthView.vue'), props: { mode: 'login' }, meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: () => import('@/views/AuthView/AuthView.vue'), props: { mode: 'register' }, meta: { guestOnly: true } },
  { path: '/admin/orders', name: 'admin-orders', component: () => import('@/views/AdminOrdersView/AdminOrdersView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/orders/:orderId', name: 'admin-order-details', component: () => import('@/views/AdminOrderDetailsView/AdminOrderDetailsView.vue'), props: (route) => ({ orderId: String(route.params.orderId) }), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/products/:productId/inventory', name: 'admin-inventory', component: () => import('@/views/AdminInventoryView/AdminInventoryView.vue'), props: (route) => ({ productId: String(route.params.productId) }), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/products', name: 'admin-products', component: () => import('@/views/AdminProductsView/AdminProductsView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/account', name: 'account', component: () => import('@/views/AccountView/AccountView.vue'), meta: { requiresAuth: true } },
  { path: '/orders', name: 'orders', component: () => import('@/views/OrdersView/OrdersView.vue'), meta: { requiresAuth: true } },
  { path: '/orders/:orderId', name: 'order-details', component: () => import('@/views/OrderDetailsView/OrderDetailsView.vue'), props: (route) => ({ orderId: String(route.params.orderId) }), meta: { requiresAuth: true } },
  { path: '/cart', name: 'cart', component: () => import('@/views/CartView/CartView.vue'), meta: { requiresAuth: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView/NotFoundView.vue') },
]

export const scrollBehavior: RouterScrollBehavior = (to, from, savedPosition) => {
  if (savedPosition) return savedPosition
  // Фильтры/пагинация в query не должны уводить пользователя к шапке.
  if (to.path === from.path) return false
  return { top: 0 }
}
