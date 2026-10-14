import { watch } from 'vue'
import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

// Guard проверяет вход при переходе; watcher — выход уже на защищённой странице.
export function watchSessionNavigation(router: Router, pinia: Pinia) {
  const auth = useAuthStore(pinia)
  return watch(() => auth.isAuthenticated, (loggedIn) => {
    if (!loggedIn && router.currentRoute.value.meta.requiresAuth) {
      void router.replace({ name: 'login' })
    }
  })
}
