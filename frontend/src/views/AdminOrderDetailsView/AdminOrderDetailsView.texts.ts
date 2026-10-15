import { orderSummaryTexts } from '@/components/orders/OrderSummary/OrderSummary.texts'

export const adminOrderDetailsViewTexts = {
  title: 'Управление заказом',
  refresh: 'Обновить заказ ↗',
  loading: 'Загружаем заказ…',
  retry: 'Повторить загрузку',
  customer: (id: number) => `Покупатель №${id}`,
  advance: (status: string) => `Перевести в статус «${orderSummaryTexts.statusName(status)}»`,
  noTransitions: 'Дальнейшие переходы статуса недоступны.',
  back: '← Вернуться к заказам магазина',
  forbidden: 'Для управления заказами нужен доступ администратора.',
} as const
