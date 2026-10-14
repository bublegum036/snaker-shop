export const catalogApiTexts = {
  productsFailed: (status: number) => `Не удалось загрузить каталог (HTTP ${status}). Попробуйте ещё раз.`,
  brandsFailed: (status: number) => `Не удалось загрузить бренды (HTTP ${status}).`,
} as const
