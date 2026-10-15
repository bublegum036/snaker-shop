export const cartItemActionsTexts = {
  confirmTitle: 'Удаление из корзины',
  confirmMessage: (name: string, size: string) => `Удалить «${name}», размер ${size}, из корзины?`,
  quantity: 'Количество',
  save: 'Сохранить',
  remove: 'Удалить',
  invalidQuantity: 'Укажите целое количество в пределах остатка.',
  quantityLabel: (name: string, size: string) => `Количество ${name}, размер ${Number(size)}`,
  removeLabel: (name: string, size: string) => `Удалить ${name}, размер ${Number(size)}`,
} as const
