import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Product, ProductSize } from '@/api/catalog.api'
import { getAdminProduct } from '@/api/admin-products.api'
import { createSize, deleteSize, updateSize, type SizePatch, type SizeWrite } from '@/api/admin-inventory.api'
import { ApiError } from '@/api/http.client'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useNotificationsStore } from '@/stores/notifications/notifications.store'
import { isPositiveId } from '@/utils/positive-id'
import { adminInventoryTexts as text, type InventoryAction } from './useAdminInventory.texts'

export function useAdminInventory(productId: () => string) {
  const auth = useAuthStore()
  const notifications = useNotificationsStore()
  const product = ref<Product | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const requiresReload = ref(false)
  const accessDenied = ref(false)
  const editorOpen = ref(false)
  const editing = ref<ProductSize | null>(null)
  const editorVersion = ref(0)
  const deleting = ref<ProductSize | null>(null)
  const isAdmin = computed(() => auth.isAuthenticated && !!auth.user?.is_admin)
  const busy = computed(() => loading.value || saving.value)
  const canWrite = computed(() => isAdmin.value && !!product.value && !busy.value && !requiresReload.value && !accessDenied.value)
  let request: AbortController | undefined
  let revision = 0
  let disposed = false

  function forbidden() {
    accessDenied.value = true
    product.value = null
    editorOpen.value = false
    deleting.value = null
    error.value = text.forbidden
  }

  async function load() {
    if (disposed || !isAdmin.value || saving.value) { return }
    request?.abort()
    error.value = ''
    const id = productId()
    if (!isPositiveId(id)) { error.value = text.invalidId; return }
    const current = new AbortController()
    request = current
    loading.value = true
    try {
      if (accessDenied.value) { await auth.refreshProfile() }
      if (current.signal.aborted || !isAdmin.value) { return }
      const result = await getAdminProduct(auth.authorizedRequest, Number(id), current.signal)
      if (!current.signal.aborted) {
        product.value = result
        requiresReload.value = accessDenied.value = false
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        requiresReload.value = true
        if (cause instanceof ApiError && cause.status === 403) { forbidden() } else {
          if (cause instanceof ApiError && cause.status === 404) { product.value = null }
          error.value = cause instanceof ApiError && cause.status === 404 ? text.missing
            : cause instanceof Error ? cause.message : text.loadFailed
        }
      }
    } finally { if (request === current) { loading.value = false } }
  }

  function openEditor(size: ProductSize | null = null) {
    if (!canWrite.value) { return }
    deleting.value = null
    editing.value = size
    editorVersion.value++
    editorOpen.value = true
    error.value = ''
  }
  function closeEditor() { if (!saving.value) { editorOpen.value = false; editing.value = null } }
  function requestDelete(size: ProductSize) { if (canWrite.value) { deleting.value = size } }
  function cancelDelete() { if (!saving.value) { deleting.value = null } }

  async function mutate(action: InventoryAction, size: string, write: (signal: AbortSignal) => Promise<unknown>): Promise<boolean> {
    if (disposed || !canWrite.value) { return false }
    request?.abort()
    const current = new AbortController()
    request = current
    const version = revision
    const id = product.value!.id
    saving.value = true
    error.value = ''
    try {
      await write(current.signal)
      if (current.signal.aborted || version !== revision) { return false }
      editorOpen.value = false
      editing.value = deleting.value = null
      notifications.success(text.confirmed(action, size))
      try {
        const result = await getAdminProduct(auth.authorizedRequest, id, current.signal)
        if (!current.signal.aborted && version === revision) { product.value = result }
      } catch {
        if (!current.signal.aborted && version === revision) {
          product.value = null
          requiresReload.value = true
          error.value = text.refreshFailed
        }
      }
      return !current.signal.aborted && version === revision
    } catch (cause) {
      if (current.signal.aborted || version !== revision) { return false }
      deleting.value = null
      if (cause instanceof ApiError) {
        if (cause.status === 403) { forbidden(); return false }
        if (cause.status === 422) { error.value = text.invalidInput; return false }
        if (cause.status === 409 && cause.code === 'size_referenced') { error.value = text.referenced; return false }
        if (cause.status === 409 && cause.code === 'size_already_exists') { error.value = text.duplicate; return false }
        error.value = cause.status === 404 ? text.missing
          : cause.code === 'concurrent_change_retry' ? text.concurrent : text.uncertain
      } else { error.value = text.uncertain }
      requiresReload.value = true
      editorOpen.value = false
      editing.value = null
      return false
    } finally { if (version === revision && request === current) { saving.value = false } }
  }

  async function save(body: SizeWrite) {
    if (!canWrite.value || !editorOpen.value) { return false }
    const id = product.value!.id
    const size = editing.value
    if (!size) { return mutate('create', body.size, (signal) => createSize(auth.authorizedRequest, id, body, signal)) }
    const patch: SizePatch = {}
    // Не отправляем старый остаток при изменении только названия размера.
    if (Number(body.size) !== Number(size.size)) { patch.size = body.size }
    if (body.stock !== size.stock) { patch.stock = body.stock }
    if (!Object.keys(patch).length) { return false }
    return mutate('update', body.size, (signal) => updateSize(auth.authorizedRequest, id, size.id, patch, signal))
  }
  async function confirmDelete() {
    const size = deleting.value
    if (!size || !product.value) { return false }
    const id = product.value.id
    return mutate('delete', size.size, (signal) => deleteSize(auth.authorizedRequest, id, size.id, signal))
  }

  watch([() => isAdmin.value ? `${auth.user!.id}:${auth.accessToken}` : null, productId], () => {
    revision++
    request?.abort()
    product.value = null
    loading.value = saving.value = false
    error.value = ''
    requiresReload.value = accessDenied.value = false
    editorOpen.value = false
    editing.value = deleting.value = null
    if (isAdmin.value) { void load() }
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; revision++; request?.abort() })
  return { product, loading, saving, error, requiresReload, accessDenied, editorOpen, editing, editorVersion, deleting,
    isAdmin, busy, canWrite, load, openEditor, closeEditor, requestDelete, cancelDelete, save, confirmDelete }
}
