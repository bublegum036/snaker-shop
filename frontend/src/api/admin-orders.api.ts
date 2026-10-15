import type { Order, OrdersQuery } from './orders.api'

export type OrderStatus = 'created' | 'processing' | 'completed'
export interface AdminOrdersQuery extends OrdersQuery { status?: OrderStatus }
type AuthorizedRequest = <T>(path: string, options?: RequestInit) => Promise<T>

export function getAdminOrders(request: AuthorizedRequest, query: AdminOrdersQuery, signal?: AbortSignal): Promise<Order[]> {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) })
  if (query.status) params.set('status', query.status)
  return request(`/admin/orders?${params}`, { signal })
}

export function getAdminOrder(request: AuthorizedRequest, id: string, signal?: AbortSignal): Promise<Order> {
  return request(`/admin/orders/${encodeURIComponent(id)}`, { signal })
}

export function updateOrderStatus(request: AuthorizedRequest, id: number, status: OrderStatus, signal?: AbortSignal): Promise<Order> {
  return request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }), signal })
}
