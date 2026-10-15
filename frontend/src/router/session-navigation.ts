import { loginReturnQuery } from './auth-redirect'
import { watch } from 'vue'
import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth/auth.store'

// Guard проверяет вход при переходе; watcher — выход уже на защищённой странице.
export function watchSessionNavigation(router: Router, pinia: Pinia) {
  const auth = useAuthStore(pinia)
  return watch(() => [auth.isAuthenticated, auth.user?.is_admin] as const, ([loggedIn, isAdmin]) => {
    if (!loggedIn && router.currentRoute.value.meta.requiresAuth) {
      void router.replace({ name: 'login', query: loginReturnQuery(router.currentRoute.value) })
    } else if (loggedIn && !isAdmin && router.currentRoute.value.meta.requiresAdmin) {
      void router.replace({ name: 'account', query: { access: 'admin-required' } })
    }
  })
}
