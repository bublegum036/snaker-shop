const titles: Readonly<Record<string, string>> = {
  catalog: 'Каталог кроссовок',
  login: 'Вход',
  register: 'Регистрация',
  account: 'Ваш профиль',
  cart: 'Корзина',
  orders: 'Ваши заказы',
  'order-details': 'Детали заказа',
}

export const routerTexts = {
  pageTitle: (name: string) => `${titles[name] ?? 'Магазин кроссовок'} — North`,
} as const
