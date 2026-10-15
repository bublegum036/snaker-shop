import { authStoreTexts as text } from './auth.store.texts'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getProfile, login as loginRequest, type Credentials, type User } from '@/api/auth.api'
import { ApiError, requestJson } from '@/api/http.client'

const STORAGE_KEY = 'north.access-token'

function readToken(): string | null {
  try { return sessionStorage.getItem(STORAGE_KEY) } catch { return null }
}

function saveToken(value: string | null) {
  try {
    if (value) { sessionStorage.setItem(STORAGE_KEY, value) } else { sessionStorage.removeItem(STORAGE_KEY) }
  } catch { /* При запрете хранилища вход работает в памяти до обновления. */ }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const initializing = ref(true)
  const busy = ref(false)
  const sessionError = ref('')
  const notice = ref('')
  const isAuthenticated = computed(() => user.value !== null && accessToken.value !== null)
  let revision = 0
  let restoration: Promise<void> | undefined
  let restoreRequest: AbortController | undefined

  function logout(message = '') {
    revision++
    restoreRequest?.abort()
    accessToken.value = null
    user.value = null
    saveToken(null)
    sessionError.value = ''
    notice.value = message
    initializing.value = false
    busy.value = false
  }

  // Обрабатываем 401 и для будущих запросов корзины/заказов.
  async function authorizedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = accessToken.value
    if (!token) { throw new ApiError(401) }
    const version = revision
    try {
      return await requestJson<T>(path, { ...options, token })
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401 && version === revision) {
        logout(text.sessionEnded)
      }
      throw cause
    }
  }

  async function restoreSession() {
    if (restoration) { return restoration }
    if (!initializing.value && !sessionError.value) { return }
    const token = accessToken.value ?? readToken()
    if (!token) { initializing.value = false; return }
    const request = new AbortController()
    restoreRequest = request
    const version = ++revision
    accessToken.value = token
    initializing.value = true
    sessionError.value = ''
    restoration = (async () => {
      try {
        const profile = await getProfile(token, request.signal)
        if (version === revision) { user.value = profile }
      } catch (cause) {
        if (version !== revision) { return }
        if (cause instanceof ApiError && cause.status === 401) {
          logout(text.sessionEnded)
        } else {
          sessionError.value = text.restoreFailed
        }
      } finally {
        if (version === revision) { initializing.value = false }
        restoration = undefined
      }
    })()
    return restoration
  }

  async function login(credentials: Credentials, signal?: AbortSignal): Promise<boolean> {
    const version = ++revision
    busy.value = true
    notice.value = ''
    sessionError.value = ''
    try {
      const result = await loginRequest(credentials, signal)
      const profile = await getProfile(result.access_token, signal)
      // Выход во время запроса не должен быть отменён запоздавшим ответом.
      if (version !== revision || signal?.aborted) { return false }
      accessToken.value = result.access_token
      user.value = profile
      saveToken(result.access_token)
      return true
    } finally {
      if (version === revision) { busy.value = false }
    }
  }

  async function refreshProfile() {
    const version = revision
    const profile = await authorizedRequest<User>('/auth/me')
    if (version === revision) { user.value = profile }
  }

  return {
    user, accessToken, initializing, busy, sessionError, notice, isAuthenticated,
    login, logout, restoreSession, refreshProfile, authorizedRequest,
  }
})
