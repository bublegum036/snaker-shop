const actions = {
  add: { confirmed: 'Товар добавлен', uncertain: 'Не удалось подтвердить добавление' },
  update: { confirmed: 'Количество обновлено', uncertain: 'Не удалось подтвердить изменение количества' },
  remove: { confirmed: 'Позиция удалена', uncertain: 'Не удалось подтвердить удаление' },
} as const

export type CartAction = keyof typeof actions

export const cartStoreTexts = {
  insufficientStock: 'Недостаточно товара с учётом количества в корзине. Обновите каталог и корзину.',
  sizeUnavailable: 'Размер больше недоступен. Обновите каталог и корзину.',
  itemUnavailable: 'Позиция больше недоступна. Обновите корзину.',
  invalidInput: 'Проверьте размер и количество, затем обновите корзину.',
  loadFailed: 'Не удалось загрузить корзину.',
  loginRequired: 'Войдите, чтобы изменить корзину.',
  chooseSize: 'Выберите размер.',
  invalidQuantity: 'Укажите целое положительное количество.',
  invalidItem: 'Некорректная позиция корзины.',
  confirmed: (action: CartAction) => `${actions[action].confirmed}.`,
  refreshAfterWriteFailed: (action: CartAction) => `${actions[action].confirmed}, но корзину не удалось обновить. Загрузите её перед следующим изменением.`,
  uncertain: (action: CartAction) => `${actions[action].uncertain}. Обновите корзину и проверьте количество перед повтором.`,
} as const
