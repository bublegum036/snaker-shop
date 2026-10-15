import { orderSummaryTexts } from '@/components/orders/OrderSummary/OrderSummary.texts'

export const adminOrderStatusTexts = {
  title: 'Изменение статуса заказа',
  question: (id: number, status: string) => `Перевести заказ №${id} в статус «${orderSummaryTexts.statusName(status)}»?`,
  hint: 'Переход к предыдущему статусу недоступен.',
  confirm: 'Изменить статус',
  saving: 'Сохраняем…',
} as const
