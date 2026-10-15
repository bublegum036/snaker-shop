import type { Brand, CatalogQuery, Product } from './catalog.api'
import { catalogQueryParams } from './catalog.api'

type AuthorizedRequest = <T>(path: string, options?: RequestInit) => Promise<T>

export type ProductWrite = Pick<Product, 'name' | 'brand_id' | 'price' | 'description' | 'image_url'>

export function getAdminProducts(request: AuthorizedRequest, query: CatalogQuery, signal?: AbortSignal): Promise<Product[]> {
  return request(`/products?${catalogQueryParams(query)}`, { signal })
}

export function getAdminBrands(request: AuthorizedRequest, signal?: AbortSignal): Promise<Brand[]> {
  return request('/brands', { signal })
}

export function createProduct(request: AuthorizedRequest, body: ProductWrite, signal?: AbortSignal): Promise<Product> {
  return request('/products', { method: 'POST', body: JSON.stringify(body), signal })
}

export function updateProduct(request: AuthorizedRequest, id: number, body: ProductWrite, signal?: AbortSignal): Promise<Product> {
  return request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body), signal })
}

export function deleteProduct(request: AuthorizedRequest, id: number, signal?: AbortSignal): Promise<void> {
  return request(`/products/${id}`, { method: 'DELETE', signal })
}
