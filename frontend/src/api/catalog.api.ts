// Decimal приходит из FastAPI строкой: точность цены сохраняется на сервере.
export interface ProductSize {
  id: number
  size: string
  stock: number
}

export interface Product {
  id: number
  name: string
  brand_id: number
  price: string
  description: string
  image_url: string | null
  sizes: ProductSize[]
}

export interface Brand {
  id: number
  name: string
}

export interface ProductFilters {
  search?: string
  brand_id?: number
  size?: number
  min_price?: number
  max_price?: number
}

export interface CatalogQuery extends ProductFilters {
  limit: number
  offset: number
}

export async function getProducts(query: CatalogQuery, signal?: AbortSignal): Promise<Product[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    // В частности, цена 0 должна попасть в запрос; пустые поля — нет.
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const response = await fetch(`/api/products?${params}`, { signal })
  if (!response.ok) {
    throw new Error(`Не удалось загрузить каталог (HTTP ${response.status}). Попробуйте ещё раз.`)
  }
  return response.json()
}

export async function getBrands(signal?: AbortSignal): Promise<Brand[]> {
  const response = await fetch('/api/brands', { signal })
  if (!response.ok) throw new Error(`Не удалось загрузить бренды (HTTP ${response.status}).`)
  return response.json()
}
