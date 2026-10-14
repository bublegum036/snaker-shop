export const orderDetailsViewTexts = {
  title: 'Детали заказа',
  refresh: 'Обновить заказ ↗',
  loading: 'Загружаем заказ…',
  retry: 'Повторить загрузку',
  items: 'Позиции заказа',
  position: (index: number) => `Позиция ${index + 1}`,
  sizeCode: 'Код размера',
  quantity: 'Количество',
  price: 'Цена за пару при покупке',
  back: '← Вернуться к истории заказов',
} as const
