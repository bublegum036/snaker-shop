import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Order } from '@/api/orders.api'
import { getAdminOrder, updateOrderStatus, type OrderStatus } from '@/api/admin-orders.api'
import { ApiError } from '@/api/http.client'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useNotificationsStore } from '@/stores/notifications/notifications.store'
import { isPositiveId } from '@/utils/positive-id'
import { adminOrderDetailsTexts as text } from './useAdminOrderDetails.texts'

export function useAdminOrderDetails(orderId: () => string) {
  const auth = useAuthStore()
  const notifications = useNotificationsStore()
  const order = ref<Order | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const requiresReload = ref(false)
  const accessDenied = ref(false)
  const confirming = ref(false)
  const isAdmin = computed(() => auth.isAuthenticated && !!auth.user?.is_admin)
  const busy = computed(() => loading.value || saving.value)
  const nextStatus = computed<OrderStatus | null>(() => order.value?.status === 'created' ? 'processing' : order.value?.status === 'processing' ? 'completed' : null)
  const canChange = computed(() => isAdmin.value && !!nextStatus.value && !busy.value && !requiresReload.value && !accessDenied.value)
  let request: AbortController | undefined
  let revision = 0
  let disposed = false

  function forbidden() { order.value = null; accessDenied.value = true; error.value = text.forbidden }
  async function load() {
    if (disposed || !isAdmin.value || saving.value) { return }
    request?.abort()
    error.value = ''
    const id = orderId()
    if (!isPositiveId(id)) { order.value = null; error.value = text.invalidId; return }
    const current = new AbortController()
    request = current
    loading.value = true
    try {
      if (accessDenied.value) { await auth.refreshProfile() }
      if (current.signal.aborted || !isAdmin.value) { return }
      const result = await getAdminOrder(auth.authorizedRequest, id, current.signal)
      if (!current.signal.aborted) { order.value = result; requiresReload.value = accessDenied.value = false }
    } catch (cause) {
      if (!current.signal.aborted) {
        requiresReload.value = true
        if (cause instanceof ApiError && cause.status === 403) { forbidden() } else {
          if (cause instanceof ApiError && cause.status === 404) { order.value = null }
          error.value = cause instanceof ApiError && cause.status === 404 ? text.missing : cause instanceof Error ? cause.message : text.loadFailed
        }
      }
    } finally { if (request === current) { loading.value = false } }
  }
  function requestChange() { if (canChange.value) { confirming.value = true } }
  function cancelChange() { if (!saving.value) { confirming.value = false } }
  async function confirmChange(): Promise<boolean> {
    if (!confirming.value || !canChange.value || !order.value || !nextStatus.value) { return false }
    const id = order.value.id
    const status = nextStatus.value
    const version = revision
    request?.abort()
    const current = new AbortController()
    request = current
    saving.value = true
    error.value = ''
    try {
      const result = await updateOrderStatus(auth.authorizedRequest, id, status, current.signal)
      if (version !== revision || current.signal.aborted) { return false }
      order.value = result
      notifications.success(text.confirmed(id))
      return true
    } catch (cause) {
      if (version !== revision || current.signal.aborted) { return false }
      requiresReload.value = true
      if (cause instanceof ApiError && cause.status === 403) { forbidden() } else {
 error.value = cause instanceof ApiError && cause.status === 409 ? text.conflict
        : cause instanceof ApiError && cause.status === 404 ? text.missing
        : cause instanceof ApiError && cause.status === 422 ? text.invalidInput : text.uncertain
}
      return false
    } finally {
      if (version === revision) { saving.value = false; confirming.value = false }
    }
  }
  watch([() => isAdmin.value ? `${auth.user!.id}:${auth.accessToken}` : null, orderId], () => {
    revision++
    request?.abort()
    order.value = null
    loading.value = saving.value = confirming.value = requiresReload.value = accessDenied.value = false
    error.value = ''
    if (isAdmin.value) { void load() }
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; revision++; request?.abort() })
  return { order, loading, saving, error, busy, isAdmin, nextStatus, canChange, confirming, load, requestChange, cancelChange, confirmChange }
}
