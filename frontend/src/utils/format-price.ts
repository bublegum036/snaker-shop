const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2,
})

// Преобразование только для показа. Суммы корзины рассчитывает сервер.
export function formatPrice(value: string): string {
  return rubles.format(Number(value))
}
