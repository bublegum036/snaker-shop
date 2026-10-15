import { onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth/auth.store'

interface Notification {
  id: number
  message: string
}

const DURATION_MS = 3000

export const useNotificationsStore = defineStore('notifications', () => {
  const auth = useAuthStore()
  const current = ref<Notification | null>(null)
  let sequence = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  function dismiss(id = current.value?.id) {
    if (id !== current.value?.id) return
    clearTimeout(timer)
    timer = undefined
    current.value = null
  }

  function success(message: string) {
    clearTimeout(timer)
    const id = ++sequence
    current.value = { id, message }
    // Старый таймер не должен закрыть более новое уведомление.
    timer = setTimeout(() => dismiss(id), DURATION_MS)
  }

  watch(() => auth.isAuthenticated ? `${auth.user!.id}:${auth.accessToken}:${auth.user!.is_admin}` : null,
    () => dismiss(), { flush: 'sync' })
  onScopeDispose(() => { clearTimeout(timer); current.value = null })
  return { current, success, dismiss }
})
