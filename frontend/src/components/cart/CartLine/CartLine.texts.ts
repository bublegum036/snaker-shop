export const cartLineTexts = {
  details: (size: string, price: string) => `Размер ${Number(size)} · ${price} за пару`,
  stockChanged: (stock: number) => `Остаток изменился: доступно ${stock}.`,
  quantity: (count: number) => `${count} шт.`,
} as const
