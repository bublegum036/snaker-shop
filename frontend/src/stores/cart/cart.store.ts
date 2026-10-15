import { cartStoreTexts as text } from './cart.store.texts'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { addCartItem, getCart, removeCartItem, updateCartItem, type Cart } from '@/api/cart.api'
import { useNotificationsStore } from '@/stores/notifications/notifications.store'
import { ApiError } from '@/api/http.client'
import { useAuthStore } from '@/stores/auth/auth.store'

import { checkout as checkoutRequest, type Order } from '@/api/orders.api'
import { checkoutTexts } from './checkout.texts'

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
  const notifications = useNotificationsStore()
  const data = ref<Cart | null>(null)
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref('')
  const order = ref<Order | null>(null)
  const checkoutError = ref('')
  const pendingKey = ref<string | null>(null)
  const checkoutPending = computed(() => pendingKey.value !== null)
  const itemCount = computed(() => data.value?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0)
  let revision = 0
  let readRequest: AbortController | undefined
  let writeRequest: AbortController | undefined

  function reset() {
    revision++
    readRequest?.abort()
    writeRequest?.abort()
    data.value = null
    order.value = null
    checkoutError.value = ''
    pendingKey.value = null
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
        error.value = cause instanceof Error ? cause.message : text.loadFailed
      }
    } finally {
      if (version === revision && readRequest === request) loading.value = false
    }
  }

  async function mutateCart(action: CartAction, write: (signal: AbortSignal) => Promise<unknown>): Promise<boolean> {
    if (!auth.isAuthenticated) throw new Error(text.loginRequired)
    if (mutating.value || loading.value || checkoutPending.value || !data.value || error.value) return false
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
        }
      } catch {
        if (version === revision && !request.signal.aborted) {
          data.value = null
          error.value = text.refreshAfterWriteFailed(action)
        }
      }
      if (version === revision && !request.signal.aborted) notifications.success(text.confirmed(action))
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

  function checkoutStorageKey() {
    return `north.checkout.${auth.user!.id}`
  }

  function clearCheckoutKey(storageKey: string) {
    try {
      sessionStorage.removeItem(storageKey)
      pendingKey.value = null
      return true
    } catch {
      checkoutError.value = checkoutTexts.storageUnavailable
      return false
    }
  }

  async function placeOrder(): Promise<boolean> {
    if (!auth.isAuthenticated || mutating.value || loading.value) return false
    // Повтор с сохранённым ключом допустим даже при уже пустой корзине.
    if (!pendingKey.value && (!data.value?.items.length || error.value)) return false
    const storageKey = checkoutStorageKey()
    checkoutError.value = ''
    try {
      const key = pendingKey.value ?? sessionStorage.getItem(storageKey) ?? crypto.randomUUID()
      sessionStorage.setItem(storageKey, key)
      if (sessionStorage.getItem(storageKey) !== key) throw new Error(checkoutTexts.storageUnavailable)
      pendingKey.value = key
    } catch {
      checkoutError.value = checkoutTexts.storageUnavailable
      return false
    }
    const key = pendingKey.value!
    const request = new AbortController()
    writeRequest = request
    const version = revision
    mutating.value = true
    order.value = null
    try {
      const result = await checkoutRequest(auth.authorizedRequest, key, request.signal)
      if (version !== revision || request.signal.aborted) return false
      order.value = result
      clearCheckoutKey(storageKey)
      // POST уже подтверждён; не превращаем сбой чтения в повторную покупку.
      data.value = null
      error.value = ''
      try {
        const result = await getCart(auth.authorizedRequest, request.signal)
        if (version === revision && !request.signal.aborted) data.value = result
      } catch {
        if (version === revision && !request.signal.aborted) error.value = checkoutTexts.refreshFailed
      }
      if (version === revision && !request.signal.aborted) notifications.success(checkoutTexts.confirmed(result.id))
      return version === revision && !request.signal.aborted
    } catch (cause) {
      if (version !== revision || request.signal.aborted) return false
      // Только однозначный отказ 4xx позволяет начать новое оформление.
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 401) {
        const cleared = clearCheckoutKey(storageKey)
        data.value = null
        error.value = checkoutTexts.rejected
        if (cleared) checkoutError.value = checkoutTexts.errors[cause.code ?? ''] ?? checkoutTexts.rejected
      } else {
        checkoutError.value = checkoutTexts.uncertain
      }
      return false
    } finally {
      if (version === revision) mutating.value = false
    }
  }

  // Синхронный сброс не оставляет данные предыдущего пользователя в интерфейсе.
  watch(() => auth.isAuthenticated ? `${auth.user!.id}:${auth.accessToken}` : null, (token) => {
    reset()
    if (token) {
      try { pendingKey.value = sessionStorage.getItem(checkoutStorageKey()) }
      catch { checkoutError.value = checkoutTexts.storageUnavailable }
      void loadCart()
    }
  }, { immediate: true, flush: 'sync' })

  return { data, loading, mutating, error, itemCount, order, checkoutError, checkoutPending, loadCart, addItem, updateItem, removeItem, placeOrder }
})
