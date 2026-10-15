export const adminSizeRowTexts = {
  size: (value: string) => `Размер ${value}`,
  stock: (value: number) => `На складе: ${value}`,
  unavailable: 'Нет в наличии',
  edit: 'Изменить',
  remove: 'Удалить',
  editLabel: (value: string) => `Изменить размер ${value} и остаток`,
  removeLabel: (value: string) => `Удалить размер ${value}`,
} as const
