import type { Product, ProductSize } from './catalog.api'

export interface CartItem extends Pick<Product, 'name' | 'price'>, Pick<ProductSize, 'size' | 'stock'> {
  id: number
  product_size_id: number
  product_id: number
  quantity: number
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
  return request('/cart/items', {
    method: 'POST', body: JSON.stringify({ product_size_id: sizeId, quantity }), signal,
  })
}
