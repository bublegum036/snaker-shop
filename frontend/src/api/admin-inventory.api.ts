import type { ProductSize } from './catalog.api'

type AuthorizedRequest = <T>(path: string, options?: RequestInit) => Promise<T>
export type SizeWrite = Pick<ProductSize, 'size' | 'stock'>
export type SizePatch = Partial<SizeWrite>

export function createSize(request: AuthorizedRequest, productId: number, body: SizeWrite, signal?: AbortSignal): Promise<ProductSize> {
  return request(`/products/${productId}/sizes`, { method: 'POST', body: JSON.stringify(body), signal })
}

export function updateSize(request: AuthorizedRequest, productId: number, sizeId: number, body: SizePatch, signal?: AbortSignal): Promise<ProductSize> {
  return request(`/products/${productId}/sizes/${sizeId}`, { method: 'PATCH', body: JSON.stringify(body), signal })
}

export function deleteSize(request: AuthorizedRequest, productId: number, sizeId: number, signal?: AbortSignal): Promise<void> {
  return request(`/products/${productId}/sizes/${sizeId}`, { method: 'DELETE', signal })
}
