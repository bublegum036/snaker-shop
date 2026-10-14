export interface OrderItem {
  id: number
  product_size_id: number
  quantity: number
  price_at_purchase: string
}

export interface Order {
  id: number
  user_id: number
  status: string
  total: string
  created_at: string
  items: OrderItem[]
}

type AuthorizedRequest = <T>(path: string, options?: RequestInit) => Promise<T>

// Цены и позиции сервер читает из корзины пользователя, а не из тела запроса.
export function checkout(request: AuthorizedRequest, key: string, signal?: AbortSignal): Promise<Order> {
  return request('/orders', {
    method: 'POST', body: JSON.stringify({}),
    headers: { 'Idempotency-Key': key }, signal,
  })
}

export interface OrdersQuery {
  limit: number
  offset: number
}

export function getOrders(request: AuthorizedRequest, query: OrdersQuery, signal?: AbortSignal): Promise<Order[]> {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) })
  return request(`/orders?${params}`, { signal })
}

export function getOrder(request: AuthorizedRequest, orderId: string, signal?: AbortSignal): Promise<Order> {
  return request(`/orders/${encodeURIComponent(orderId)}`, { signal })
}
