import { routes, scrollBehavior } from './routes'
import { routerTexts as text } from './router.texts'
import { createRouter, createWebHistory } from 'vue-router'
import { sessionGuard } from './session-guard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior,
})

router.beforeEach(sessionGuard)

router.afterEach((to) => {
  document.title = text.pageTitle(String(to.name))
})

export default router
