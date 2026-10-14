import type { LocationQuery, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { isOrderId } from '@/utils/order-id'

export function loginReturnQuery(route: Pick<RouteLocationNormalized, 'name' | 'params'>) {
  if (route.name === 'order-details' && isOrderId(route.params.orderId)) {
    return { next: 'order-details', orderId: route.params.orderId }
  }
  return { next: route.name === 'cart' ? 'cart' : route.name === 'orders' ? 'orders' : 'account' }
}

export function loginDestination(query: LocationQuery): RouteLocationRaw {
  if (query.next === 'order-details' && isOrderId(query.orderId)) {
    return { name: 'order-details', params: { orderId: query.orderId } }
  }
  const name = query.next === 'catalog' || query.next === 'cart' || query.next === 'orders'
    ? query.next : 'account'
  return { name }
}
