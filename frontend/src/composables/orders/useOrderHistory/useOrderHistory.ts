import { onScopeDispose, ref, watch } from 'vue'
import { getOrders, type Order } from '@/api/orders.api'
import { useAuthStore } from '@/stores/auth/auth.store'
import { orderHistoryTexts as text } from './useOrderHistory.texts'

const PAGE_SIZE = 10

export function useOrderHistory() {
  const auth = useAuthStore()
  const orders = ref<Order[]>([])
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const requestedPage = ref(1)
  const hasNextPage = ref(false)
  let request: AbortController | undefined
  let disposed = false

  async function load(targetPage = page.value) {
    if (disposed || !auth.isAuthenticated || !Number.isInteger(targetPage) || targetPage < 1) { return }
    request?.abort()
    const current = new AbortController()
    request = current
    requestedPage.value = targetPage
    loading.value = true
    error.value = ''
    try {
      // Одна дополнительная запись определяет наличие следующей страницы.
      const result = await getOrders(auth.authorizedRequest, {
        limit: PAGE_SIZE + 1, offset: (targetPage - 1) * PAGE_SIZE,
      }, current.signal)
      if (current.signal.aborted) { return }
      orders.value = result.slice(0, PAGE_SIZE)
      hasNextPage.value = result.length > PAGE_SIZE
      page.value = targetPage
    } catch (cause) {
      if (!current.signal.aborted) { error.value = cause instanceof Error ? cause.message : text.loadFailed }
    } finally {
      if (request === current) { loading.value = false }
    }
  }

  watch(() => auth.isAuthenticated ? `${auth.user!.id}:${auth.accessToken}` : null, (session) => {
    request?.abort()
    orders.value = []
    error.value = ''
    loading.value = false
    page.value = requestedPage.value = 1
    hasNextPage.value = false
    if (session) { void load(1) }
  }, { immediate: true, flush: 'sync' })

  onScopeDispose(() => { disposed = true; request?.abort() })
  return { orders, loading, error, page, requestedPage, hasNextPage, load }
}
