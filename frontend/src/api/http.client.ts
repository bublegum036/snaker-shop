export class ApiError extends Error {
  constructor(public status: number, public code?: string) {
    super(status >= 500
      ? 'Сервер временно недоступен. Попробуйте ещё раз.'
      : `Не удалось выполнить запрос (HTTP ${status}).`)
  }
}

interface RequestOptions extends RequestInit {
  token?: string
}

// Отправляем JWT только в локальный API; пароль и ответы с токеном не логируем.
export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Некорректный путь API.')
  const { token, signal, ...init } = options
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), 10_000)
  try {
    const response = await fetch(`/api${path}`, {
      ...init, headers,
      signal: signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const code = typeof body?.detail === 'string' && /^[a-z_]{1,80}$/.test(body.detail)
        ? body.detail : undefined
      throw new ApiError(response.status, code)
    }
    return response.status === 204 ? undefined as T : await response.json()
  } catch (cause) {
    if (signal?.aborted) throw cause
    if (timeout.signal.aborted) throw new Error('Сервер не ответил вовремя. Попробуйте ещё раз.')
    if (cause instanceof TypeError) throw new Error('Нет связи с сервером. Попробуйте ещё раз.')
    throw cause
  } finally {
    clearTimeout(timer)
  }
}
