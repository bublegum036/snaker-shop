import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Brand, Product } from '@/api/catalog.api'
import { createProduct, deleteProduct, getAdminBrands, getAdminProducts, updateProduct, type ProductWrite } from '@/api/admin-products.api'
import { useNotificationsStore } from '@/stores/notifications/notifications.store'
import { ApiError } from '@/api/http.client'
import { useAuthStore } from '@/stores/auth/auth.store'
import { adminProductsTexts as text, type ProductAction } from './useAdminProducts.texts'

const PAGE_SIZE = 10

export function useAdminProducts() {
  const auth = useAuthStore()
  const notifications = useNotificationsStore()
  const products = ref<Product[]>([])
  const brands = ref<Brand[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const requiresReload = ref(false)
  const accessDenied = ref(false)
  const page = ref(1)
  const requestedPage = ref(1)
  const hasNextPage = ref(false)
  const editorOpen = ref(false)
  const editing = ref<Product | null>(null)
  const editorVersion = ref(0)
  const deleting = ref<Product | null>(null)
  const isAdmin = computed(() => auth.isAuthenticated && !!auth.user?.is_admin)
  const busy = computed(() => loading.value || saving.value)
  const canWrite = computed(() => isAdmin.value && !busy.value && !requiresReload.value && !accessDenied.value && brands.value.length > 0)
  let revision = 0
  let request: AbortController | undefined
  let disposed = false

  async function readPage(targetPage: number, signal: AbortSignal) {
    const [items, availableBrands] = await Promise.all([
      getAdminProducts(auth.authorizedRequest, { limit: PAGE_SIZE + 1, offset: (targetPage - 1) * PAGE_SIZE }, signal),
      getAdminBrands(auth.authorizedRequest, signal),
    ])
    return { items, availableBrands }
  }

  function applyPage(targetPage: number, result: Awaited<ReturnType<typeof readPage>>) {
    products.value = result.items.slice(0, PAGE_SIZE)
    brands.value = result.availableBrands
    hasNextPage.value = result.items.length > PAGE_SIZE
    page.value = targetPage
    requiresReload.value = false
  }

  function handleForbidden() {
    accessDenied.value = true
    products.value = []
    brands.value = []
    editorOpen.value = false
    deleting.value = null
    error.value = text.forbidden
  }

  async function load(targetPage = page.value) {
    if (disposed || !isAdmin.value || saving.value || !Number.isInteger(targetPage) || targetPage < 1) { return }
    request?.abort()
    const current = new AbortController()
    request = current
    loading.value = true
    requestedPage.value = targetPage
    error.value = ''
    try {
      // Перечитываем роль: список товаров публичный и сам по себе не доказывает доступ.
      if (accessDenied.value) { await auth.refreshProfile() }
      if (current.signal.aborted || !isAdmin.value) { return }
      const result = await readPage(targetPage, current.signal)
      if (!current.signal.aborted) {
        applyPage(targetPage, result)
        accessDenied.value = false
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        if (cause instanceof ApiError && cause.status === 403) { handleForbidden() } else { requiresReload.value = true; error.value = cause instanceof Error ? cause.message : text.loadFailed }
      }
    } finally {
      if (request === current) { loading.value = false }
    }
  }

  function openEditor(product: Product | null = null) {
    if (!canWrite.value) { return }
    deleting.value = null
    editing.value = product
    editorVersion.value++
    editorOpen.value = true
    error.value = ''
  }

  function closeEditor() {
    if (saving.value) { return }
    editorOpen.value = false
    editing.value = null
  }

  function requestDelete(product: Product) {
    if (!canWrite.value) { return }
    deleting.value = product
  }

  function cancelDelete() { if (!saving.value) { deleting.value = null } }

  async function mutate(action: ProductAction, name: string, write: (signal: AbortSignal) => Promise<unknown>): Promise<boolean> {
    if (disposed || !canWrite.value) { return false }
    request?.abort()
    const current = new AbortController()
    request = current
    const version = revision
    saving.value = true
    error.value = ''
    try {
      await write(current.signal)
      if (current.signal.aborted || version !== revision) { return false }
      editorOpen.value = false
      editing.value = deleting.value = null
      notifications.success(text.confirmed(action, name))
      const targetPage = action === 'create' ? 1 : page.value
      requestedPage.value = targetPage
      try {
        const result = await readPage(targetPage, current.signal)
        if (!current.signal.aborted && version === revision) { applyPage(targetPage, result) }
      } catch {
        if (!current.signal.aborted && version === revision) {
          products.value = []
          requiresReload.value = true
          error.value = text.refreshFailed
        }
      }
      return !current.signal.aborted && version === revision
    } catch (cause) {
      if (current.signal.aborted || version !== revision) { return false }
      if (cause instanceof ApiError) {
        switch (cause.status) {
          case 403: handleForbidden(); return false
          case 422: error.value = text.invalidInput; return false
          case 404: error.value = text.missing; break
          case 409: error.value = text.conflict(action); break
          default: error.value = text.uncertain
        }
      } else { error.value = text.uncertain }
      // При потерянном ответе POST мог создать товар: не предлагаем повтор формы.
      requiresReload.value = true
      editorOpen.value = false
      editing.value = deleting.value = null
      return false
    } finally {
      if (version === revision && request === current) { saving.value = false }
    }
  }

  async function save(body: ProductWrite) {
    if (!editorOpen.value) { return false }
    const product = editing.value
    return mutate(product ? 'update' : 'create', body.name, (signal) => product
      ? updateProduct(auth.authorizedRequest, product.id, body, signal)
      : createProduct(auth.authorizedRequest, body, signal))
  }

  async function confirmDelete() {
    const product = deleting.value
    if (!product) { return false }
    return mutate('delete', product.name, (signal) => deleteProduct(auth.authorizedRequest, product.id, signal))
  }

  watch(() => isAdmin.value ? `${auth.user!.id}:${auth.accessToken}` : null, (session) => {
    revision++
    request?.abort()
    products.value = []; brands.value = []
    loading.value = saving.value = false
    error.value = ''
    editorOpen.value = false
    editing.value = deleting.value = null
    requiresReload.value = accessDenied.value = false
    page.value = requestedPage.value = 1
    hasNextPage.value = false
    if (session) { void load(1) }
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; revision++; request?.abort() })

  return { products, brands, loading, saving, busy, error, requiresReload, accessDenied, page, requestedPage, hasNextPage,
    editorOpen, editing, editorVersion, deleting, isAdmin, canWrite, load, openEditor, closeEditor, requestDelete, cancelDelete, save, confirmDelete }
}
