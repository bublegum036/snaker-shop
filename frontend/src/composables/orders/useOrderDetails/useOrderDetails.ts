import { onScopeDispose, ref, watch } from 'vue'
import { getOrder, type Order } from '@/api/orders.api'
import { isOrderId } from '@/utils/order-id'
import { ApiError } from '@/api/http.client'
import { useAuthStore } from '@/stores/auth/auth.store'
import { orderDetailsTexts as text } from './useOrderDetails.texts'

export function useOrderDetails(orderId: () => string) {
  const auth = useAuthStore()
  const order = ref<Order | null>(null)
  const loading = ref(false)
  const error = ref('')
  let request: AbortController | undefined
  let disposed = false

  async function load() {
    request?.abort()
    order.value = null
    loading.value = false
    error.value = ''
    if (disposed || !auth.isAuthenticated) return
    const id = orderId()
    if (!isOrderId(id)) { error.value = text.invalidId; return }
    const current = new AbortController()
    request = current
    loading.value = true
    try {
      const result = await getOrder(auth.authorizedRequest, id, current.signal)
      if (!current.signal.aborted) order.value = result
    } catch (cause) {
      if (!current.signal.aborted) {
        error.value = cause instanceof ApiError && cause.status === 404
          ? text.notFound : cause instanceof Error ? cause.message : text.loadFailed
      }
    } finally {
      if (request === current) loading.value = false
    }
  }

  watch([() => auth.isAuthenticated ? `${auth.user!.id}:${auth.accessToken}` : null, orderId], () => {
    void load()
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; request?.abort() })
  return { order, loading, error, load }
}
