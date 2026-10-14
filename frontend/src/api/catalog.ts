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

export async function getProducts(): Promise<Product[]> {
  const response = await fetch('/api/products?limit=20&offset=0')
  if (!response.ok) {
    throw new Error(`Не удалось загрузить каталог (HTTP ${response.status}). Попробуйте ещё раз.`)
  }
  return response.json()
}
