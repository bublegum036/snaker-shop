export const adminProductRowTexts = {
  brandUnknown: 'Бренд недоступен',
  sizes: (count: number) => `Размеров: ${count}`,
  edit: 'Редактировать',
  inventory: 'Размеры и склад',
  remove: 'Удалить',
  editLabel: (name: string) => `Редактировать товар «${name}»`,
  removeLabel: (name: string) => `Удалить товар «${name}»`,
} as const
