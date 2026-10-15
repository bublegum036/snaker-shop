export const adminSizeDeleteTexts = {
  title: 'Удаление размера',
  question: (size: string, name: string) => `Удалить размер ${size} товара «${name}»?`,
  hint: 'Размер, который используется в корзине или заказе, удалить нельзя. Для снятия с продажи можно установить остаток 0.',
  confirm: 'Удалить размер',
  cancel: 'Отмена',
  deleting: 'Удаляем…',
} as const
