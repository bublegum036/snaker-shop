export const cartLinkTexts = {
  label: (count: number | null, pending: boolean) => count !== null
    ? `Корзина (${count})`
    : pending ? 'Корзина (…)' : 'Корзина',
} as const
