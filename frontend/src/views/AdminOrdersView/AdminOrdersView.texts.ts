import { orderSummaryTexts } from '@/components/orders/OrderSummary/OrderSummary.texts'

export const adminOrdersViewTexts = {
  title: 'Заказы магазина',
  refresh: 'Обновить заказы ↗',
  loading: 'Загружаем заказы…',
  retry: 'Повторить загрузку',
  status: 'Статус заказа',
  statusOptions: [
    { value: '', label: 'Все статусы' },
    { value: 'created', label: orderSummaryTexts.statusName('created') },
    { value: 'processing', label: orderSummaryTexts.statusName('processing') },
    { value: 'completed', label: orderSummaryTexts.statusName('completed') },
  ],
  customer: (id: number) => `Покупатель №${id}`,
  empty: 'Заказов по выбранному фильтру нет.',
  open: 'Управлять заказом →',
  listLabel: 'Заказы всех покупателей',
  pagination: 'Страницы заказов магазина',
  previous: '← Назад',
  next: 'Далее →',
  page: (value: number) => `Страница ${value}`,
  forbidden: 'Для управления заказами нужен доступ администратора.',
} as const
