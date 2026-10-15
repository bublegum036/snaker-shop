import type { Brand, Product } from '@/api/catalog.api'
import type { ProductWrite } from '@/api/admin-products.api'
import { adminProductFormTexts as text } from './AdminProductForm.texts'

export interface ProductDraft {
  name: string
  brandId: string
  price: string
  description: string
  imageUrl: string
}

export function productDraft(product: Product | null): ProductDraft {
  return {
    name: product?.name ?? '', brandId: product ? String(product.brand_id) : '',
    price: product?.price ?? '', description: product?.description ?? '', imageUrl: product?.image_url ?? '',
  }
}

export function productBody(draft: ProductDraft, brands: Brand[]): ProductWrite {
  const name = draft.name.trim()
  const price = draft.price.trim().replace(',', '.').replace(/^0+(?=\d)/, '')
  const brandId = Number(draft.brandId)
  if (!name || name.length > 120) { throw new Error(text.nameInvalid) }
  if (!Number.isInteger(brandId) || !brands.some((brand) => brand.id === brandId)) { throw new Error(text.brandInvalid) }
  // Цена остаётся строкой: не округляем денежные значения через Number.
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(price) || !/[1-9]/.test(price)) { throw new Error(text.priceInvalid) }
  if (draft.description.length > 2000) { throw new Error(text.descriptionInvalid) }
  const image = draft.imageUrl.trim()
  if (image) {
    try {
      const url = new URL(image)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') { throw new Error() }
    } catch { throw new Error(text.imageInvalid) }
  }
  return { name, brand_id: brandId, price, description: draft.description, image_url: image || null }
}
