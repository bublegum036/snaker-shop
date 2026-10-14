import { cartStoreTexts as text } from './cart.store.texts'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { addCartItem, getCart, removeCartItem, updateCartItem, type Cart } from '@/api/cart.api'
import { ApiError } from '@/api/http.client'
import { useAuthStore } from '@/stores/auth/auth.store'

import type { CartAction } from './cart.store.texts'

function getMutationErrorMessage(cause: unknown, action: CartAction): string {
  // Бизнес-код приоритетнее общего HTTP-статуса.
  if (cause instanceof ApiError && cause.code === 'insufficient_stock') {
    return text.insufficientStock
  }
  switch (cause instanceof ApiError ? cause.status : undefined) {
    case 404:
      return action === 'add'
        ? text.sizeUnavailable
        : text.itemUnavailable
    case 422:
      return text.invalidInput
    default:
      return text.uncertain(action)
  }
}

export const useCartStore = defineStore('cart', () => {
  const auth = useAuthStore()
  const data = ref<Cart | null>(null)
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref('')
  const notice = ref('')
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
    notice.value = ''
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
    notice.value = ''
    try {
      const result = await getCart(auth.authorizedRequest, request.signal)
      if (version === revision && !request.signal.aborted) data.value = result
    } catch (cause) {
      if (version === revision && !request.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : text.loadFailed
      }
    } finally {
      if (version === revision && readRequest === request) loading.value = false
    }
  }

  async function mutateCart(action: CartAction, write: (signal: AbortSignal) => Promise<unknown>): Promise<boolean> {
    if (!auth.isAuthenticated) throw new Error(text.loginRequired)
    if (mutating.value || loading.value || !data.value || error.value) return false
    notice.value = ''
    readRequest?.abort()
    const request = new AbortController()
    writeRequest = request
    const version = revision
    mutating.value = true
    try {
      await write(request.signal)
      if (version !== revision || request.signal.aborted) return false
      // Запись подтверждена. Ошибка последующего GET не означает ошибку записи.
      try {
        const result = await getCart(auth.authorizedRequest, request.signal)
        if (version === revision && !request.signal.aborted) {
          data.value = result
          notice.value = text.confirmed(action)
        }
      } catch {
        if (version === revision && !request.signal.aborted) {
          data.value = null
          error.value = text.refreshAfterWriteFailed(action)
        }
      }
      return version === revision && !request.signal.aborted
    } catch (cause) {
      if (version !== revision || request.signal.aborted) return false
      data.value = null
      error.value = getMutationErrorMessage(cause, action)
      throw new Error(error.value)
    } finally {
      if (version === revision) mutating.value = false
    }
  }

  function requirePositiveInteger(value: number, message: string) {
    if (!Number.isInteger(value) || value <= 0 || value > 2147483647) throw new Error(message)
  }

  async function addItem(sizeId: number, quantity: number): Promise<boolean> {
    requirePositiveInteger(sizeId, text.chooseSize)
    requirePositiveInteger(quantity, text.invalidQuantity)
    return mutateCart('add', (signal) => addCartItem(auth.authorizedRequest, sizeId, quantity, signal))
  }

  async function updateItem(itemId: number, quantity: number): Promise<boolean> {
    requirePositiveInteger(itemId, text.invalidItem)
    requirePositiveInteger(quantity, text.invalidQuantity)
    return mutateCart('update', (signal) => updateCartItem(auth.authorizedRequest, itemId, quantity, signal))
  }

  async function removeItem(itemId: number): Promise<boolean> {
    requirePositiveInteger(itemId, text.invalidItem)
    return mutateCart('remove', (signal) => removeCartItem(auth.authorizedRequest, itemId, signal))
  }

  // Синхронный сброс не оставляет данные предыдущего пользователя в интерфейсе.
  watch(() => auth.isAuthenticated ? auth.accessToken : null, (token) => {
    reset()
    if (token) void loadCart()
  }, { immediate: true, flush: 'sync' })

  return { data, loading, mutating, error, notice, itemCount, loadCart, addItem, updateItem, removeItem }
})
