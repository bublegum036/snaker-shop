import type { LocationQuery, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { isPositiveId } from '@/utils/positive-id'

export function loginReturnQuery(route: Pick<RouteLocationNormalized, 'name' | 'params'>) {
  if ((route.name === 'order-details' || route.name === 'admin-order-details') && isPositiveId(route.params.orderId)) {
    return { next: String(route.name), orderId: route.params.orderId }
  }
  if (route.name === 'admin-inventory' && isPositiveId(route.params.productId)) {
    return { next: 'admin-inventory', productId: route.params.productId }
  }
  if (route.name === 'admin-orders') return { next: 'admin-orders' }
  if (route.name === 'admin-products') return { next: 'admin-products' }
  return { next: route.name === 'cart' ? 'cart' : route.name === 'orders' ? 'orders' : 'account' }
}

export function loginDestination(query: LocationQuery): RouteLocationRaw {
  if ((query.next === 'order-details' || query.next === 'admin-order-details') && isPositiveId(query.orderId)) {
    return { name: query.next, params: { orderId: query.orderId } }
  }
  if (query.next === 'admin-inventory' && isPositiveId(query.productId)) {
    return { name: 'admin-inventory', params: { productId: query.productId } }
  }
  const name = query.next === 'catalog' || query.next === 'cart' || query.next === 'orders' || query.next === 'admin-products' || query.next === 'admin-orders'
    ? query.next : 'account'
  return { name }
}
