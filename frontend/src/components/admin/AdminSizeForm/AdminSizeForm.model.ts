import type { ProductSize } from '@/api/catalog.api'
import type { SizeWrite } from '@/api/admin-inventory.api'
import { adminSizeFormTexts as text } from './AdminSizeForm.texts'

export interface SizeDraft {
  size: string
  stock: number | ''
}

export function sizeDraft(size: ProductSize | null): SizeDraft {
  return { size: size?.size ?? '', stock: size?.stock ?? 0 }
}

export function sizeBody(draft: SizeDraft): SizeWrite {
  const size = draft.size.trim().replace(',', '.').replace(/^0+(?=\d)/, '')
  if (!/^\d{1,3}(\.\d)?$/.test(size) || Number(size) <= 0 || Number(size) > 999) throw new Error(text.invalidSize)
  if (typeof draft.stock !== 'number' || !Number.isInteger(draft.stock) || draft.stock < 0 || draft.stock > 2147483647) throw new Error(text.invalidStock)
  return { size: size.includes('.') ? size : `${size}.0`, stock: draft.stock }
}
