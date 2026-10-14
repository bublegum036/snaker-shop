export const httpClientTexts = {
  serverUnavailable: 'Сервер временно недоступен. Попробуйте ещё раз.',
  requestFailed: (status: number) => `Не удалось выполнить запрос (HTTP ${status}).`,
  invalidPath: 'Некорректный путь API.',
  timeout: 'Сервер не ответил вовремя. Попробуйте ещё раз.',
  networkError: 'Нет связи с сервером. Попробуйте ещё раз.',
} as const
