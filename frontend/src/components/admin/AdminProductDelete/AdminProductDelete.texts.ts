export const adminProductDeleteTexts = {
  title: 'Подтверждение удаления',
  question: (name: string) => `Удалить товар «${name}» вместе с его размерами?`,
  hint: 'Сервер разрешит удаление, только если товар не используется в корзинах и заказах.',
  confirm: 'Удалить товар',
  deleting: 'Удаляем…',
  cancel: 'Отмена',
} as const
