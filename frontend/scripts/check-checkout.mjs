// Изолированные сценарии: рабочие аккаунты, заказы и склад не изменяются.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
const storage = new Map()
const memoryStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }
const setStorage = (value) => Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value })
setStorage(memoryStorage)
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const flush = () => new Promise((resolve) => setImmediate(resolve))
const credentials = { email: 'fixture@example.com', password: 'fixture-only' }
const profile = { id: 9001, email: credentials.email, is_admin: false }
const row = { id: 1, product_size_id: 302, product_id: 32, name: 'Fixture', size: '42.0', price: '5000.00', quantity: 1, stock: 3, subtotal: '5000.00' }
const order = { id: 7001, user_id: profile.id, status: 'created', total: '4990.00', created_at: '2026-10-15T12:00:00Z', items: [{ id: 1, product_size_id: 302, quantity: 1, price_at_purchase: '4990.00', name_at_purchase: 'Original sneaker', size_at_purchase: '42.0' }] }
let handler, pair, apiCart, keys, records, passed = 0, user = profile
let rejectOrders, loseResponse, failRead
const previousFetch = (url, init) => handler(String(url), init)
globalThis.fetch = previousFetch
try {
  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth/auth.store.ts')
  const { useNotificationsStore } = await server.ssrLoadModule('/src/stores/notifications/notifications.store.ts')
  const { useCartStore } = await server.ssrLoadModule('/src/stores/cart/cart.store.ts')
  function defaultHandler(url, init) {
    if (url === '/api/auth/login') { return Promise.resolve(json({ access_token: 'fixture-token', token_type: 'bearer' })) }
    if (url === '/api/auth/me') { return Promise.resolve(json(user)) }
    assert.ok(init.headers.get('Authorization'))
    if (url === '/api/cart') { return failRead ? Promise.reject(new TypeError('offline')) : Promise.resolve(json(apiCart)) }
    assert.equal(url, '/api/orders')
    assert.equal(init.method, 'POST')
    assert.deepEqual(JSON.parse(init.body), {})
    const key = init.headers.get('Idempotency-Key')
    assert.match(key, /^[0-9a-f-]{36}$/)
    keys.push(key)
    if (rejectOrders) { return Promise.resolve(json({ detail: rejectOrders }, 409)) }
    if (!records.has(key)) {
      records.set(key, { ...order, user_id: user.id })
      apiCart = { items: [], estimated_total: '0.00' }
    }
    if (loseResponse) { return Promise.reject(new TypeError('response lost')) }
    return Promise.resolve(json(records.get(key), 201))
  }
  function setup(clear = true) {
    pair?.notifications.$dispose(); pair?.cart.$dispose(); pair?.auth.$dispose()
    setActivePinia(createPinia())
    setStorage(memoryStorage)
    if (clear) {
      storage.clear(); records = new Map(); keys = []
      apiCart = { items: [row], estimated_total: '5000.00' }
      rejectOrders = undefined; loseResponse = false; failRead = false; user = profile
    }
    handler = defaultHandler
    pair = { auth: useAuthStore(), cart: useCartStore(), notifications: useNotificationsStore() }
    return pair
  }
  async function login() { await pair.auth.login(credentials); await flush() }
  async function fresh() { setup(); await login(); return pair }
  async function check(name, run) { await run(); passed++; console.log(`OK: ${name}`) }

  await check('guest and empty cart cannot checkout', async () => {
    setup(); assert.equal(await pair.cart.placeOrder(), false); assert.equal(keys.length, 0)
    await login(); apiCart.items = []; await pair.cart.loadCart()
    assert.equal(await pair.cart.placeOrder(), false); assert.equal(keys.length, 0)
  })
  await check('success uses server total and refreshes shared cart', async () => {
    const { cart } = await fresh()
    assert.equal(await cart.placeOrder(), true)
    assert.equal(cart.order.total, '4990.00'); assert.equal(cart.itemCount, 0)
    assert.equal(cart.checkoutPending, false); assert.equal(storage.has('north.checkout.9001'), false)
    assert.match(pair.notifications.current.message, /Заказ №7001 оформлен/)
  })
  await check('lost response replays same key and blocks cart writes', async () => {
    const { cart } = await fresh(); loseResponse = true
    assert.equal(await cart.placeOrder(), false); assert.equal(cart.checkoutPending, true)
    assert.match(cart.checkoutError, /Результат оформления пока неизвестен/)
    assert.equal(pair.notifications.current, null)
    assert.equal(await cart.addItem(302, 1), false)
    assert.equal(await cart.updateItem(1, 2), false)
    assert.equal(await cart.removeItem(1), false)
    await cart.loadCart(); assert.equal(cart.itemCount, 0)
    loseResponse = false; assert.equal(await cart.placeOrder(), true)
    assert.equal(keys[0], keys[1]); assert.equal(records.size, 1)
  })
  await check('reload restores key even when server cart is already empty', async () => {
    await fresh(); loseResponse = true; await pair.cart.placeOrder()
    const key = keys[0]; setup(false); loseResponse = false; await login()
    assert.equal(pair.cart.checkoutPending, true)
    assert.equal(await pair.cart.placeOrder(), true); assert.equal(keys[1], key); assert.equal(records.size, 1)
  })
  await check('stock rejection permits correction and a new key', async () => {
    const { cart } = await fresh(); rejectOrders = 'insufficient_stock'
    await cart.placeOrder(); assert.equal(cart.checkoutPending, false)
    assert.match(cart.checkoutError, /Недостаточно товара/); assert.equal(cart.data, null)
    assert.equal(await cart.placeOrder(), false)
    await cart.loadCart(); rejectOrders = undefined; await cart.placeOrder()
    assert.notEqual(keys[0], keys[1])
  })
  await check('confirmed order survives failed cart refresh without repeating POST', async () => {
    const { cart } = await fresh(); failRead = true
    assert.equal(await cart.placeOrder(), true); assert.equal(cart.order.id, 7001)
    assert.match(cart.error, /Заказ создан/); assert.equal(cart.data, null)
    assert.equal(await cart.placeOrder(), false); assert.equal(keys.length, 1)
    failRead = false; await cart.loadCart(); assert.equal(cart.itemCount, 0)
  })
  await check('parallel checkout and cart writes are blocked', async () => {
    const { cart } = await fresh(); let resolve
    handler = (url, init) => url === '/api/orders' ? new Promise((done) => { resolve = done }) : defaultHandler(url, init)
    const request = cart.placeOrder()
    assert.equal(await cart.placeOrder(), false); assert.equal(await cart.removeItem(1), false)
    apiCart = { items: [], estimated_total: '0.00' }; resolve(json(order, 201)); await request
  })
  await check('late checkout cannot reveal order to another session', async () => {
    const { cart, auth } = await fresh(); let resolve
    handler = (url, init) => url === '/api/orders' ? new Promise((done) => { resolve = done }) : defaultHandler(url, init)
    const request = cart.placeOrder(); auth.logout(); user = { ...profile, id: 9002 }; await login()
    resolve(json(order, 201)); assert.equal(await request, false)
    assert.equal(cart.order, null); assert.equal(cart.checkoutPending, false)
    assert.ok(storage.has('north.checkout.9001'))
  })
  await check('401 ends session but keeps pending key for original user', async () => {
    const { cart, auth } = await fresh()
    handler = (url, init) => url === '/api/orders' ? Promise.resolve(json({ detail: 'unknown_user' }, 401)) : defaultHandler(url, init)
    await cart.placeOrder(); assert.equal(auth.isAuthenticated, false); assert.equal(cart.order, null)
    assert.ok(storage.has('north.checkout.9001'))
    handler = defaultHandler; await login(); assert.equal(cart.checkoutPending, true)
  })
  await check('server failure keeps key for explicit replay', async () => {
    const { cart } = await fresh()
    handler = (url, init) => url === '/api/orders' ? Promise.resolve(json({}, 503)) : defaultHandler(url, init)
    await cart.placeOrder(); assert.equal(cart.checkoutPending, true)
    assert.match(cart.checkoutError, /Результат оформления пока неизвестен/)
  })
  await check('blocked storage prevents sending an unpersisted checkout', async () => {
    const { cart } = await fresh()
    setStorage({ ...memoryStorage, setItem() { throw new Error('blocked') } })
    assert.equal(await cart.placeOrder(), false); assert.equal(keys.length, 0)
    assert.match(cart.checkoutError, /хранилище вкладки/)
  })
  await check('failure to clear key blocks a new purchase and allows safe replay', async () => {
    const { cart } = await fresh()
    setStorage({ ...memoryStorage, removeItem() { throw new Error('blocked') } })
    assert.equal(await cart.placeOrder(), true); assert.equal(cart.checkoutPending, true)
    assert.equal(cart.order.id, 7001)
    setStorage(memoryStorage); assert.equal(await cart.placeOrder(), true)
    assert.equal(records.size, 1); assert.equal(keys[0], keys[1]); assert.equal(cart.checkoutPending, false)
  })
  await check('unreadable pending storage cannot be overwritten with a new key', async () => {
    const { cart } = await fresh()
    storage.set('north.checkout.9001', 'existing-attempt')
    setStorage({ ...memoryStorage, getItem() { throw new Error('blocked') } })
    assert.equal(await cart.placeOrder(), false); assert.equal(keys.length, 0)
    assert.equal(storage.get('north.checkout.9001'), 'existing-attempt')
  })
  await check('a subsequent purchase receives a fresh key', async () => {
    const { cart } = await fresh(); await cart.placeOrder()
    apiCart = { items: [row], estimated_total: '5000.00' }; await cart.loadCart()
    await cart.placeOrder(); assert.notEqual(keys[0], keys[1]); assert.equal(records.size, 2)
  })
  console.log(`Checkout checks: ${passed} passed. No real orders or database changes.`)
} finally {
  pair?.notifications.$dispose(); pair?.cart.$dispose(); pair?.auth.$dispose()
  globalThis.fetch = originalFetch
  if (originalStorage) { Object.defineProperty(globalThis, 'sessionStorage', originalStorage) } else { delete globalThis.sessionStorage }
  await server.close()
}
