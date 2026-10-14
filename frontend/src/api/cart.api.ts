import type { Product, ProductSize } from './catalog.api'

export interface CartQuantity {
  quantity: number
}

export interface CartAdd extends CartQuantity {
  product_size_id: number
}

export interface CartItem extends Pick<Product, 'name' | 'price'>, Pick<ProductSize, 'size' | 'stock'>, CartQuantity {
  id: number
  product_size_id: number
  product_id: number
  subtotal: string
}

export interface Cart {
  items: CartItem[]
  estimated_total: string
}

// Передаём авторизованный клиент из auth.store: обработка 401 остаётся общей.
type AuthorizedRequest = <T>(path: string, options?: RequestInit) => Promise<T>

export function getCart(request: AuthorizedRequest, signal?: AbortSignal): Promise<Cart> {
  return request('/cart', { signal })
}

export function addCartItem(request: AuthorizedRequest, sizeId: number, quantity: number, signal?: AbortSignal): Promise<CartItem> {
  const body: CartAdd = { product_size_id: sizeId, quantity }
  return request('/cart/items', {
    method: 'POST', body: JSON.stringify(body), signal,
  })
}

export function updateCartItem(request: AuthorizedRequest, itemId: number, quantity: number, signal?: AbortSignal): Promise<CartItem> {
  const body: CartQuantity = { quantity }
  return request(`/cart/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(body), signal })
}

export function removeCartItem(request: AuthorizedRequest, itemId: number, signal?: AbortSignal): Promise<void> {
  return request(`/cart/items/${itemId}`, { method: 'DELETE', signal })
}
