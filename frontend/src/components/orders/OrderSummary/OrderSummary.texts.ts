const statuses: Readonly<Record<string, string>> = {
  created: 'Создан', processing: 'В обработке', completed: 'Завершён',
}

export const orderSummaryTexts = {
  number: (id: number) => `Заказ №${id}`,
  date: 'Дата оформления',
  total: 'Сумма заказа',
  status: 'Статус',
  positions: 'Позиций',
  statusName: (value: string) => statuses[value] ?? 'Статус уточняется',
  dateValue: (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Дата уточняется'
      : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  },
} as const
