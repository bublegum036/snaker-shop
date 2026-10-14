import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { addCartItem, getCart, type Cart } from '@/api/cart.api'
import { ApiError } from '@/api/http.client'
import { useAuthStore } from '@/stores/auth.store'

function getAddErrorMessage(cause: unknown): string {
  // Бизнес-код приоритетнее общего HTTP-статуса.
  if (cause instanceof ApiError && cause.code === 'insufficient_stock') {
    return 'Недостаточно товара с учётом количества в корзине. Обновите каталог и корзину.'
  }
  switch (cause instanceof ApiError ? cause.status : undefined) {
    case 404:
      return 'Размер больше недоступен. Обновите каталог и корзину.'
    case 422:
      return 'Проверьте размер и количество, затем обновите корзину.'
    default:
      return 'Не удалось подтвердить добавление. Обновите корзину и проверьте количество перед повтором.'
  }
}

export const useCartStore = defineStore('cart', () => {
  const auth = useAuthStore()
  const data = ref<Cart | null>(null)
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref('')
  const itemCount = computed(() => data.value?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0)
  let revision = 0
  let readRequest: AbortController | undefined
  let writeRequest: AbortController | undefined

  function reset() {
    revision++
    readRequest?.abort()
    writeRequest?.abort()
    data.value = null
    error.value = ''
    loading.value = false
    mutating.value = false
  }

  async function loadCart() {
    if (!auth.isAuthenticated || mutating.value) return
    readRequest?.abort()
    const request = new AbortController()
    readRequest = request
    const version = revision
    loading.value = true
    data.value = null
    error.value = ''
    try {
      const result = await getCart(auth.authorizedRequest, request.signal)
      if (version === revision && !request.signal.aborted) data.value = result
    } catch (cause) {
      if (version === revision && !request.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить корзину.'
      }
    } finally {
      if (version === revision && readRequest === request) loading.value = false
    }
  }

  async function addItem(sizeId: number, quantity: number): Promise<boolean> {
    if (!auth.isAuthenticated) throw new Error('Войдите, чтобы добавить товар.')
    if (mutating.value || loading.value || !data.value || error.value) return false
    if (!Number.isInteger(sizeId) || sizeId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Выберите размер и целое положительное количество.')
    }
    readRequest?.abort()
    const request = new AbortController()
    writeRequest = request
    const version = revision
    mutating.value = true
    try {
      await addCartItem(auth.authorizedRequest, sizeId, quantity, request.signal)
      if (version !== revision || request.signal.aborted) return false
      // POST подтверждён. Если GET завершится ошибкой, повторять POST нельзя.
      data.value = null
      try {
        const result = await getCart(auth.authorizedRequest, request.signal)
        if (version === revision && !request.signal.aborted) data.value = result
      } catch {
        if (version === revision && !request.signal.aborted) {
          error.value = 'Товар добавлен, но корзину не удалось обновить. Загрузите её перед следующим добавлением.'
        }
      }
      return version === revision && !request.signal.aborted
    } catch (cause) {
      if (version !== revision || request.signal.aborted) return false
      data.value = null
      error.value = getAddErrorMessage(cause)
      throw new Error(error.value)
    } finally {
      if (version === revision) mutating.value = false
    }
  }

  // Синхронный сброс не оставляет данные предыдущего пользователя в интерфейсе.
  watch(() => auth.isAuthenticated ? auth.accessToken : null, (token) => {
    reset()
    if (token) void loadCart()
  }, { immediate: true, flush: 'sync' })

  return { data, loading, mutating, error, itemCount, loadCart, addItem }
})
