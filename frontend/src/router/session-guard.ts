import type { RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth/auth.store'
import { loginReturnQuery } from './auth-redirect'

export async function sessionGuard(to: RouteLocationNormalized) {
  if (!to.meta.requiresAuth && !to.meta.requiresAdmin && !to.meta.guestOnly) return
  const auth = useAuthStore()
  await auth.restoreSession()
  if ((to.meta.requiresAuth || to.meta.requiresAdmin) && !auth.isAuthenticated) {
    return { name: 'login', query: loginReturnQuery(to) }
  }
  if (to.meta.requiresAdmin && !auth.user?.is_admin) {
    return { name: 'account', query: { access: 'admin-required' } }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'account' }
}
