const titles: Readonly<Record<string, string>> = {
  catalog: 'Каталог кроссовок',
  login: 'Вход',
  register: 'Регистрация',
  account: 'Ваш профиль',
  'admin-orders': 'Заказы магазина',
  'admin-order-details': 'Управление заказом',
  'admin-products': 'Управление товарами',
  'admin-inventory': 'Размеры и склад',
  cart: 'Корзина',
  orders: 'Ваши заказы',
  'order-details': 'Детали заказа',
  'not-found': 'Страница не найдена',
}

export const routerTexts = {
  pageTitle: (name: string) => `${titles[name] ?? 'Магазин кроссовок'} — North`,
} as const
