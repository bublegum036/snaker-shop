// Реальная таблица маршрутов, memory history; без браузера, API и рабочих данных.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createRouter, createMemoryHistory } from 'vue-router'

const server = await createServer({
  server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
})
let passed = 0
const check = async (name, run) => { await run(); passed++; console.log(`OK: ${name}`) }

try {
  const { routes, scrollBehavior } = await server.ssrLoadModule('/src/router/routes.ts')
  const { routerTexts } = await server.ssrLoadModule('/src/router/router.texts.ts')
  const router = createRouter({ history: createMemoryHistory(), routes })

  await check('unknown and nested URLs resolve to public 404', () => {
    for (const path of ['/missing', '/admin/missing/deep', '/products/unknown']) {
      const route = router.resolve(path)
      assert.equal(route.name, 'not-found')
      assert.equal(route.meta.requiresAuth, undefined)
      assert.equal(route.meta.requiresAdmin, undefined)
    }
  })
  await check('known pages retain priority and access metadata', () => {
    assert.equal(router.resolve('/').name, 'catalog')
    assert.equal(router.resolve('/login').meta.guestOnly, true)
    for (const path of ['/account', '/cart', '/orders', '/orders/12']) {
      assert.equal(router.resolve(path).meta.requiresAuth, true)
      assert.notEqual(router.resolve(path).name, 'not-found')
    }
    for (const path of ['/admin/products', '/admin/products/32/inventory', '/admin/orders', '/admin/orders/12']) {
      const route = router.resolve(path)
      assert.equal(route.meta.requiresAuth, true)
      assert.equal(route.meta.requiresAdmin, true)
      assert.notEqual(route.name, 'not-found')
    }
  })
  await check('detail routes preserve typed string props', () => {
    for (const [path, key, value] of [['/orders/12', 'orderId', '12'], ['/admin/orders/13', 'orderId', '13'], ['/admin/products/32/inventory', 'productId', '32']]) {
      const route = router.resolve(path)
      assert.deepEqual(route.matched[0].props.default(route), { [key]: value })
    }
  })
  await check('every deferred page loads and compiles', async () => {
    for (const route of routes) {
      if (route.name === 'catalog') continue
      assert.equal(typeof route.component, 'function')
      assert.ok((await route.component()).default)
    }
  })
  await check('404 has a meaningful browser title', () => {
    assert.equal(routerTexts.pageTitle('not-found'), 'Страница не найдена — North')
  })
  await check('back navigation restores saved position', () => {
    const saved = { left: 0, top: 720 }
    assert.equal(scrollBehavior(router.resolve('/'), router.resolve('/cart'), saved), saved)
  })
  await check('new page starts at top; same-page query preserves position', () => {
    assert.deepEqual(scrollBehavior(router.resolve('/cart'), router.resolve('/'), null), { top: 0 })
    assert.equal(scrollBehavior(router.resolve('/?page=2'), router.resolve('/?page=1'), null), false)
  })
  console.log(`Router checks passed: ${passed}`)
} finally {
  await server.close()
}
