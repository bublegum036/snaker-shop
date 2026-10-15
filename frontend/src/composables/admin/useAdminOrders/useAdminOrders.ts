import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Order } from '@/api/orders.api'
import { getAdminOrders, type OrderStatus } from '@/api/admin-orders.api'
import { ApiError } from '@/api/http.client'
import { useAuthStore } from '@/stores/auth/auth.store'
import { adminOrdersTexts as text } from './useAdminOrders.texts'

const PAGE_SIZE = 10

export function useAdminOrders() {
  const auth = useAuthStore()
  const orders = ref<Order[]>([])
  const status = ref<OrderStatus | ''>('')
  const page = ref(1)
  const requestedPage = ref(1)
  const hasNextPage = ref(false)
  const loading = ref(false)
  const error = ref('')
  const accessDenied = ref(false)
  const isAdmin = computed(() => auth.isAuthenticated && !!auth.user?.is_admin)
  let request: AbortController | undefined
  let disposed = false

  async function load(targetPage = page.value) {
    if (disposed || !isAdmin.value || !Number.isInteger(targetPage) || targetPage < 1) { return }
    request?.abort()
    const current = new AbortController()
    request = current
    requestedPage.value = targetPage
    loading.value = true
    error.value = ''
    try {
      if (accessDenied.value) { await auth.refreshProfile() }
      if (current.signal.aborted || !isAdmin.value) { return }
      const result = await getAdminOrders(auth.authorizedRequest, { limit: PAGE_SIZE + 1, offset: (targetPage - 1) * PAGE_SIZE, status: status.value || undefined }, current.signal)
      if (current.signal.aborted) { return }
      orders.value = result.slice(0, PAGE_SIZE)
      hasNextPage.value = result.length > PAGE_SIZE
      page.value = targetPage
      accessDenied.value = false
    } catch (cause) {
      if (!current.signal.aborted) {
        if (cause instanceof ApiError && cause.status === 403) { orders.value = []; accessDenied.value = true; error.value = text.forbidden } else { error.value = cause instanceof Error ? cause.message : text.loadFailed }
      }
    } finally { if (request === current) { loading.value = false } }
  }
  watch([() => isAdmin.value ? `${auth.user!.id}:${auth.accessToken}` : null, status], () => {
    request?.abort()
    orders.value = []
    page.value = requestedPage.value = 1
    hasNextPage.value = loading.value = false
    error.value = ''
    if (isAdmin.value) { void load(1) }
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; request?.abort() })
  return { orders, status, page, requestedPage, hasNextPage, loading, error, isAdmin, load }
}
