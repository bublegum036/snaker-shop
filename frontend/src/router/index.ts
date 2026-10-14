import { createRouter, createWebHistory } from 'vue-router'
import CatalogView from '@/views/CatalogView.vue'
import AuthView from '@/views/AuthView.vue'
import AccountView from '@/views/AccountView.vue'
import { useAuthStore } from '@/stores/auth.store'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'catalog', component: CatalogView },
    { path: '/login', name: 'login', component: AuthView, props: { mode: 'login' }, meta: { guestOnly: true } },
    { path: '/register', name: 'register', component: AuthView, props: { mode: 'register' }, meta: { guestOnly: true } },
    { path: '/account', name: 'account', component: AccountView, meta: { requiresAuth: true } },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth && !to.meta.guestOnly) return
  const auth = useAuthStore()
  await auth.restoreSession()
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'login' }
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'account' }
})

router.afterEach((to) => {
  const titles: Record<string, string> = {
    catalog: 'Каталог кроссовок', login: 'Вход', register: 'Регистрация', account: 'Ваш профиль',
  }
  document.title = `${titles[String(to.name)] ?? 'Магазин кроссовок'} — North`
})

export default router
