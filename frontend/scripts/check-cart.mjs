// Только фиктивные ответы: рабочая БД и реальные корзины не изменяются.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} },
})
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const flush = () => new Promise((resolve) => setImmediate(resolve))
const profile = { id: 9001, email: 'fixture@example.com', is_admin: false }
const credentials = { email: profile.email, password: 'fixture-only-not-a-real-password' }
const row = { id: 1, product_size_id: 302, product_id: 32, name: 'Fixture sneaker', size: '42.0', price: '5000.00', quantity: 1, stock: 3, subtotal: '5000.00' }
let handler, apiCart, posts, patches, deletes, lastBody, lastItemId, previous, passed = 0
globalThis.fetch = (url, init) => handler(String(url), init)

try {
  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth/auth.store.ts')
  const { useNotificationsStore } = await server.ssrLoadModule('/src/stores/notifications/notifications.store.ts')
  const { useCartStore } = await server.ssrLoadModule('/src/stores/cart/cart.store.ts')
  function defaultHandler(url, init) {
    if (url === '/api/auth/login') return Promise.resolve(json({ access_token: 'fixture-not-a-jwt', token_type: 'bearer' }))
    if (url === '/api/auth/me') return Promise.resolve(json(profile))
    assert.ok(init.headers.get('Authorization')?.startsWith('Bearer '))
    if (url === '/api/cart') return Promise.resolve(json(apiCart))
    const itemPath = url.match(/^\/api\/cart\/items\/(\d+)$/)
    if (itemPath) {
      lastItemId = Number(itemPath[1])
      const item = apiCart.items.find((item) => item.id === lastItemId)
      if (init.method === 'PATCH') patches++
      else { assert.equal(init.method, 'DELETE'); deletes++ }
      if (!item) return Promise.resolve(json({ detail: 'cart_item_not_found' }, 404))
      if (init.method === 'PATCH') {
        lastBody = JSON.parse(init.body)
        assert.deepEqual(Object.keys(lastBody), ['quantity'])
        if (lastBody.quantity > item.stock) return Promise.resolve(json({ detail: 'insufficient_stock' }, 409))
        apiCart.items = apiCart.items.map((current) => current.id === item.id
          ? { ...current, quantity: lastBody.quantity, subtotal: `${lastBody.quantity * 5000}.00` } : current)
      } else {
        assert.equal(init.body, undefined)
        apiCart.items = apiCart.items.filter((current) => current.id !== item.id)
      }
      apiCart.estimated_total = `${apiCart.items.reduce((sum, item) => sum + Number(item.subtotal), 0)}.00`
      return Promise.resolve(init.method === 'DELETE'
        ? new Response(null, { status: 204 }) : json(apiCart.items.find((current) => current.id === item.id)))
    }
    assert.equal(url, '/api/cart/items')
    assert.equal(init.method, 'POST')
    posts++
    lastBody = JSON.parse(init.body)
    assert.equal(lastBody.product_size_id, 302)
    assert.deepEqual(Object.keys(lastBody).sort(), ['product_size_id', 'quantity'])
    const quantity = (apiCart.items[0]?.quantity ?? 0) + lastBody.quantity
    if (quantity > row.stock) return Promise.resolve(json({ detail: 'insufficient_stock' }, 409))
    const item = { ...row, quantity, subtotal: `${quantity * 5000}.00` }
    apiCart = { items: [item], estimated_total: item.subtotal }
    return Promise.resolve(json(item))
  }
  function fresh() {
    previous?.notifications.$dispose()
    previous?.cart.$dispose()
    previous?.auth.$dispose()
    setActivePinia(createPinia())
    handler = defaultHandler
    apiCart = { items: [], estimated_total: '0.00' }
    posts = 0
    patches = 0
    deletes = 0
    lastBody = undefined
    previous = { auth: useAuthStore(), cart: useCartStore(), notifications: useNotificationsStore() }
    return previous
  }
  async function signedIn() {
    const pair = fresh()
    await pair.auth.login(credentials)
    await flush()
    assert.ok(pair.cart.data)
    return pair
  }
  async function check(name, run) { await run(); passed++; console.log(`OK: ${name}`) }

  await check('guest does not load or mutate cart', async () => {
    const { cart } = fresh()
    handler = () => { throw new Error('Unexpected request') }
    await cart.loadCart()
    await assert.rejects(cart.addItem(302, 1))
    assert.equal(cart.data, null)
  })

  await check('login loads personal cart; badge counts quantities', async () => {
    const { cart } = await signedIn()
    assert.equal(cart.itemCount, 0)
    apiCart = { items: [{ ...row, quantity: 2 }, { ...row, id: 2, product_size_id: 303 }], estimated_total: '15000.00' }
    await cart.loadCart()
    assert.equal(cart.itemCount, 3)
  })

  await check('add uses size ID and server total; repeated add increments same position', async () => {
    const { cart } = await signedIn()
    assert.equal(await cart.addItem(302, 1), true)
    assert.deepEqual(lastBody, { product_size_id: 302, quantity: 1 })
    assert.match(previous.notifications.current.message, /Товар добавлен/)
    assert.equal(await cart.addItem(302, 1), true)
    assert.equal(cart.data.items.length, 1)
    assert.equal(cart.itemCount, 2)
    assert.equal(cart.data.estimated_total, '10000.00')
  })

  await check('invalid quantities never reach server', async () => {
    const { cart } = await signedIn()
    for (const quantity of [0, -1, 1.5, NaN]) await assert.rejects(cart.addItem(302, quantity))
    assert.equal(posts, 0)
  })

  await check('409 insufficient_stock is readable and requires cart refresh', async () => {
    const { cart, auth } = await signedIn()
    await assert.rejects(cart.addItem(302, 4), /Недостаточно товара/)
    assert.equal(posts, 1)
    assert.equal(cart.data, null)
    assert.equal(auth.isAuthenticated, true)
    assert.equal(await cart.addItem(302, 1), false)
    await cart.loadCart()
    assert.equal(cart.itemCount, 0)
  })

  for (const { status, detail, message } of [
    { status: 404, detail: 'size_not_found', message: /Размер больше недоступен/ },
    { status: 422, detail: 'invalid_quantity', message: /Проверьте размер и количество/ },
    { status: 409, detail: 'other_conflict', message: /Не удалось подтвердить добавление/ },
  ]) {
    await check(`add error ${status}/${detail} preserves its meaning`, async () => {
      const { cart } = await signedIn()
      handler = async () => json({ detail }, status)
      await assert.rejects(cart.addItem(302, 1), message)
      assert.equal(cart.data, null)
      assert.equal(cart.mutating, false)
    })
  }

  await check('parallel add is blocked while POST is pending', async () => {
    const { cart } = await signedIn()
    let resolve
    handler = (url, init) => url === '/api/cart/items'
      ? new Promise((done) => { resolve = () => { defaultHandler(url, init).then(done) } })
      : defaultHandler(url, init)
    const pending = cart.addItem(302, 1)
    assert.equal(await cart.addItem(302, 1), false)
    resolve()
    assert.equal(await pending, true)
    assert.equal(posts, 1)
  })

  await check('confirmed POST plus failed GET does not invite duplicate add', async () => {
    const { cart } = await signedIn()
    handler = (url, init) => url === '/api/cart' ? Promise.resolve(json({}, 503)) : defaultHandler(url, init)
    assert.equal(await cart.addItem(302, 1), true)
    assert.equal(cart.data, null)
    assert.match(cart.error, /Товар добавлен/)
    assert.equal(await cart.addItem(302, 1), false)
    assert.equal(posts, 1)
    handler = defaultHandler
    await cart.loadCart()
    assert.equal(cart.itemCount, 1)
  })

  await check('uncertain POST is not retried; explicit GET reconciles server state', async () => {
    const { cart } = await signedIn()
    handler = async (url, init) => {
      const result = await defaultHandler(url, init)
      if (url === '/api/cart/items') throw new TypeError('fixture connection lost after write')
      return result
    }
    await assert.rejects(cart.addItem(302, 1), /Не удалось подтвердить/)
    assert.equal(posts, 1)
    assert.equal(cart.data, null)
    handler = defaultHandler
    await cart.loadCart()
    assert.equal(cart.itemCount, 1)
  })

  await check('logout clears cart immediately and discards a late read', async () => {
    const { auth, cart } = await signedIn()
    let resolve
    handler = () => new Promise((done) => { resolve = done })
    const pending = cart.loadCart()
    auth.logout()
    assert.equal(cart.data, null)
    resolve(json({ items: [row], estimated_total: '5000.00' }))
    await pending
    assert.equal(cart.data, null)
    assert.equal(cart.loading, false)
  })

  await check('late POST cannot replace cart of the next session', async () => {
    const { auth, cart } = await signedIn()
    let resolve
    handler = (url, init) => url === '/api/cart/items'
      ? new Promise((done) => { resolve = done }) : defaultHandler(url, init)
    const pending = cart.addItem(302, 1)
    auth.logout()
    handler = defaultHandler
    await auth.login(credentials)
    await flush()
    resolve(json(row))
    assert.equal(await pending, false)
    assert.equal(cart.itemCount, 0)
    assert.equal(cart.mutating, false)
  })

  await check('401 clears auth and cart; 503 preserves authentication', async () => {
    const { auth, cart } = await signedIn()
    handler = async () => json({}, 503)
    await cart.loadCart()
    assert.equal(auth.isAuthenticated, true)
    assert.ok(cart.error)
    handler = async () => json({}, 401)
    await cart.loadCart()
    assert.equal(auth.isAuthenticated, false)
    assert.equal(cart.data, null)
    assert.equal(cart.error, '')
  })

  await check('PATCH uses cart item ID and sets absolute quantity', async () => {
    const { cart } = await signedIn()
    await cart.addItem(302, 1)
    assert.equal(await cart.updateItem(row.id, 2), true)
    assert.equal(lastItemId, row.id)
    assert.deepEqual(lastBody, { quantity: 2 })
    assert.equal(cart.itemCount, 2)
    assert.equal(cart.data.estimated_total, '10000.00')
    await cart.updateItem(row.id, 2)
    assert.equal(cart.itemCount, 2)
    await cart.updateItem(row.id, 1)
    assert.equal(cart.itemCount, 1)
    assert.equal(cart.data.estimated_total, '5000.00')
    assert.match((previous.notifications.current?.message ?? ''), /Количество обновлено/)
  })

  await check('DELETE accepts empty 204 and refreshes total and badge', async () => {
    const { cart } = await signedIn()
    await cart.addItem(302, 1)
    assert.equal(await cart.removeItem(row.id), true)
    assert.equal(lastItemId, row.id)
    assert.equal(deletes, 1)
    assert.equal(cart.itemCount, 0)
    assert.equal(cart.data.estimated_total, '0.00')
    assert.match((previous.notifications.current?.message ?? ''), /Позиция удалена/)
  })

  await check('invalid edit and delete values never reach API', async () => {
    const { cart } = await signedIn()
    await cart.addItem(302, 1)
    for (const value of [0, -1, 1.5, NaN, 2147483648]) {
      await assert.rejects(cart.updateItem(row.id, value))
      await assert.rejects(cart.removeItem(value))
    }
    assert.equal(patches, 0)
    assert.equal(deletes, 0)
  })

  await check('PATCH insufficient stock keeps server quantity intact', async () => {
    const { cart } = await signedIn()
    await cart.addItem(302, 1)
    await assert.rejects(cart.updateItem(row.id, 4), /Недостаточно товара/)
    assert.equal(apiCart.items[0].quantity, 1)
    assert.equal(cart.data, null)
    await cart.loadCart()
    assert.equal(cart.itemCount, 1)
  })

  for (const action of ['updateItem', 'removeItem']) {
    await check(`${action} handles a stale position with 404`, async () => {
      const { cart } = await signedIn()
      await cart.addItem(302, 1)
      apiCart = { items: [], estimated_total: '0.00' }
      await assert.rejects(cart[action](row.id, 2), /Позиция больше недоступна/)
      await cart.loadCart()
      assert.equal(cart.itemCount, 0)
    })
  }

  for (const action of ['updateItem', 'removeItem']) {
    await check(`confirmed ${action} plus failed GET is not repeated`, async () => {
      const { cart } = await signedIn()
      await cart.addItem(302, 1)
      handler = (url, init) => url === '/api/cart' ? Promise.resolve(json({}, 503)) : defaultHandler(url, init)
      assert.equal(await cart[action](row.id, 2), true)
      assert.match(cart.error, action === 'updateItem' ? /Количество обновлено/ : /Позиция удалена/)
      assert.equal(cart.data, null)
      assert.equal(await cart[action](row.id, 2), false)
      assert.equal(action === 'updateItem' ? patches : deletes, 1)
      handler = defaultHandler
      await cart.loadCart()
      assert.equal(cart.itemCount, action === 'updateItem' ? 2 : 0)
    })
  }

  await check('lost PATCH response reconciles without automatic repeat', async () => {
    const { cart } = await signedIn()
    await cart.addItem(302, 1)
    handler = async (url, init) => {
      const result = await defaultHandler(url, init)
      if (init.method === 'PATCH') throw new TypeError('fixture lost PATCH response')
      return result
    }
    await assert.rejects(cart.updateItem(row.id, 2), /Не удалось подтвердить изменение/)
    assert.equal(patches, 1)
    handler = defaultHandler
    await cart.loadCart()
    assert.equal(cart.itemCount, 2)
  })

  await check('late PATCH cannot replace cart of a new session', async () => {
    const { auth, cart } = await signedIn()
    await cart.addItem(302, 1)
    let resolve
    handler = (url, init) => init.method === 'PATCH'
      ? new Promise((done) => { resolve = done }) : defaultHandler(url, init)
    const pending = cart.updateItem(row.id, 2)
    auth.logout()
    apiCart = { items: [], estimated_total: '0.00' }
    handler = defaultHandler
    await auth.login(credentials)
    await flush()
    resolve(json({ ...row, quantity: 2 }))
    assert.equal(await pending, false)
    assert.equal(cart.itemCount, 0)
    assert.equal((previous.notifications.current?.message ?? ''), '')
  })

  await check('edit and delete share the write lock', async () => {
    const { cart } = await signedIn()
    await cart.addItem(302, 1)
    let resolve
    handler = (url, init) => init.method === 'PATCH'
      ? new Promise((done) => { resolve = () => defaultHandler(url, init).then(done) }) : defaultHandler(url, init)
    const pending = cart.updateItem(row.id, 2)
    assert.equal(await cart.removeItem(row.id), false)
    assert.equal(await cart.addItem(302, 1), false)
    resolve()
    await pending
    assert.equal(patches, 1)
    assert.equal(deletes, 0)
  })

  console.log(`Cart checks: ${passed} passed. No real accounts or database changes.`)
} finally {
  previous?.notifications.$dispose(); previous?.cart.$dispose()
  previous?.auth.$dispose()
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else delete globalThis.sessionStorage
  await server.close()
}
