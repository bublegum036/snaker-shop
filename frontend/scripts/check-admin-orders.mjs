// Только фиктивные HTTP-ответы: рабочие заказы и их статусы не изменяются.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, ref } from 'vue'

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} } })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const flush = () => new Promise((resolve) => setImmediate(resolve))
const profile = { id: 9001, email: 'fixture@example.com', is_admin: true }
const credentials = { email: profile.email, password: 'fixture-only' }
const fixture = (id, status = 'created') => ({ id, user_id: 9002, status, total: '7990.00', created_at: '2026-10-15T12:00:00Z', items: [{ id: 1, product_size_id: 101, quantity: 1, price_at_purchase: '7990.00', name_at_purchase: 'Fixture', size_at_purchase: '42.0' }] })
let auth, notifications, scopes = [], dataset, handler, user, calls, writes, id, failure, loseResponse, passed = 0
const mount = (factory) => { const scope = effectScope(); scopes.push(scope); return scope.run(factory) }
globalThis.fetch = (url, init) => handler(String(url), init)
try {
  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth/auth.store.ts')
  const { useNotificationsStore } = await server.ssrLoadModule('/src/stores/notifications/notifications.store.ts')
  const { useAdminOrders } = await server.ssrLoadModule('/src/composables/admin/useAdminOrders/useAdminOrders.ts')
  const { useAdminOrderDetails } = await server.ssrLoadModule('/src/composables/admin/useAdminOrderDetails/useAdminOrderDetails.ts')
  const { loginDestination, loginReturnQuery } = await server.ssrLoadModule('/src/router/auth-redirect.ts')
  function defaultHandler(url, init) {
    if (url === '/api/auth/login') { return Promise.resolve(json({ access_token: 'fixture-token', token_type: 'bearer' })) }
    if (url === '/api/auth/me') { return Promise.resolve(json(user)) }
    assert.equal(init.headers.get('Authorization'), 'Bearer fixture-token'); calls.push(url)
    if (failure) { return Promise.resolve(json({ detail: failure.code }, failure.status)) }
    const parsed = new URL(url, 'http://fixture.local')
    if (parsed.pathname === '/api/admin/orders') {
      const status = parsed.searchParams.get('status')
      const rows = status ? dataset.filter((order) => order.status === status) : dataset
      const offset = Number(parsed.searchParams.get('offset')), limit = Number(parsed.searchParams.get('limit'))
      return Promise.resolve(json(rows.slice(offset, offset + limit)))
    }
    const order = dataset.find((row) => row.id === Number(parsed.pathname.split('/')[init.method ? 3 : 4]))
    if (!order) { return Promise.resolve(json({ detail: 'order_not_found' }, 404)) }
    if (init.method) {
      assert.equal(init.method, 'PATCH'); assert.match(url, /^\/api\/orders\/\d+\/status$/)
      const body = JSON.parse(init.body); assert.deepEqual(Object.keys(body), ['status']); writes.push(body)
      order.status = body.status
      if (loseResponse) { return Promise.reject(new TypeError('response lost')) }
    }
    return Promise.resolve(json(order))
  }
  function setup() {
    scopes.forEach((scope) => scope.stop()); scopes = []; notifications?.$dispose(); auth?.$dispose()
    setActivePinia(createPinia()); auth = useAuthStore(); notifications = useNotificationsStore()
    user = { ...profile }; dataset = Array.from({ length: 12 }, (_, index) => fixture(100 - index, index === 0 ? 'processing' : 'created'))
    calls = []; writes = []; id = ref('99'); failure = undefined; loseResponse = false; handler = defaultHandler
  }
  async function fresh() { setup(); await auth.login(credentials) }
  const details = () => mount(() => useAdminOrderDetails(() => id.value))
  async function check(name, run) { await run(); passed++; console.log(`OK: ${name}`) }

  await check('guest and customer never request privileged orders', async () => {
    setup(); mount(useAdminOrders); details(); await flush(); assert.equal(calls.length, 0)
    user.is_admin = false; await auth.login(credentials); await flush(); assert.equal(calls.length, 0)
  })
  await check('list uses admin API with lookahead and pagination', async () => {
    await fresh(); const state = mount(useAdminOrders); await flush()
    assert.equal(calls[0], '/api/admin/orders?limit=11&offset=0'); assert.equal(state.orders.value.length, 10)
    await state.load(2); assert.equal(state.orders.value.length, 2); assert.equal(state.hasNextPage.value, false)
  })
  await check('status filter resets page and queries server', async () => {
    await fresh(); const state = mount(useAdminOrders); await flush(); await state.load(2)
    state.status.value = 'processing'; await flush()
    assert.equal(state.page.value, 1); assert.equal(state.orders.value.length, 1)
    assert.equal(calls.at(-1), '/api/admin/orders?limit=11&offset=0&status=processing')
  })
  await check('list failure can retry requested page', async () => {
    await fresh(); const state = mount(useAdminOrders); await flush(); failure = { status: 503 }
    await state.load(2); assert.equal(state.page.value, 1); assert.equal(state.requestedPage.value, 2)
    failure = undefined; await state.load(state.requestedPage.value); assert.equal(state.page.value, 2)
  })
  await check('detail reads foreign order only through admin API', async () => {
    await fresh(); const state = details(); await flush(); assert.equal(state.order.value.id, 99)
    assert.equal(state.order.value.user_id, 9002); assert.deepEqual(calls, ['/api/admin/orders/99'])
  })
  await check('status change requires explicit confirmation and cancel sends no request', async () => {
    await fresh(); const state = details(); await flush(); assert.equal(await state.confirmChange(), false)
    state.requestChange(); assert.equal(state.confirming.value, true); state.cancelChange(); assert.equal(writes.length, 0)
  })
  await check('created advances once to processing then completed with fresh confirmations', async () => {
    await fresh(); const state = details(); await flush(); assert.equal(state.nextStatus.value, 'processing')
    state.requestChange(); assert.equal(await state.confirmChange(), true)
    assert.deepEqual(writes[0], { status: 'processing' }); assert.equal(state.order.value.status, 'processing')
    assert.match(notifications.current.message, /№99 обновлён/); assert.equal(state.confirming.value, false)
    state.requestChange(); await state.confirmChange(); assert.deepEqual(writes[1], { status: 'completed' })
    assert.equal(state.nextStatus.value, null); assert.equal(state.canChange.value, false)
  })
  await check('conflict blocks further mutation until order refresh', async () => {
    await fresh(); const state = details(); await flush(); failure = { status: 409, code: 'invalid_status_transition' }
    state.requestChange(); assert.equal(await state.confirmChange(), false)
    assert.match(state.error.value, /Статус уже изменился/); assert.equal(state.canChange.value, false); assert.equal(notifications.current, null)
    dataset[1].status = 'completed'; failure = undefined; await state.load(); assert.equal(state.nextStatus.value, null)
  })
  await check('lost status response is reconciled without automatic PATCH retry', async () => {
    await fresh(); const state = details(); await flush(); loseResponse = true; state.requestChange(); await state.confirmChange()
    assert.equal(dataset[1].status, 'processing'); assert.equal(state.canChange.value, false)
    assert.match(state.error.value, /Результат смены статуса неизвестен/); assert.equal(notifications.current, null)
    loseResponse = false; await state.load(); assert.equal(state.order.value.status, 'processing'); assert.equal(writes.length, 1)
  })
  await check('parallel status changes and cancellation while saving are blocked', async () => {
    await fresh(); const state = details(); await flush(); let resolve
    handler = (url, init) => init.method ? new Promise((done) => { resolve = done }) : defaultHandler(url, init)
    state.requestChange(); const request = state.confirmChange(); state.cancelChange()
    assert.equal(state.confirming.value, true); assert.equal(await state.confirmChange(), false)
    resolve(json(fixture(99, 'processing'))); await request; assert.equal(state.order.value.status, 'processing')
  })
  await check('404 and invalid id provide no editable order', async () => {
    await fresh(); id.value = '999'; const state = details(); await flush(); assert.match(state.error.value, /не найден/)
    const count = calls.length; id.value = '../99'; await flush(); assert.match(state.error.value, /Некорректный номер/); assert.equal(calls.length, count)
  })
  await check('403 blocks mutation and rechecks revoked role', async () => {
    await fresh(); const state = details(); await flush(); failure = { status: 403 }; state.requestChange(); await state.confirmChange()
    assert.equal(state.order.value, null); user.is_admin = false; failure = undefined; await state.load(); assert.equal(state.isAdmin.value, false)
  })
  await check('401 clears loaded list and detail', async () => {
    await fresh(); const list = mount(useAdminOrders); const state = details(); await flush()
    failure = { status: 401 }; await state.load(); assert.equal(auth.isAuthenticated, false)
    assert.deepEqual(list.orders.value, []); assert.equal(state.order.value, null)
  })
  await check('route change ignores delayed status response and success', async () => {
    await fresh(); const state = details(); await flush(); let resolve
    handler = () => new Promise((done) => { resolve = done }); state.requestChange(); const old = state.confirmChange()
    handler = defaultHandler; id.value = '98'; await flush(); resolve(json(fixture(99, 'processing'))); await old
    assert.equal(state.order.value.id, 98); assert.equal(notifications.current, null)
  })
  await check('logout cancels pending read and clears confidential list', async () => {
    await fresh(); const list = mount(useAdminOrders); await flush(); let resolve
    handler = () => new Promise((done) => { resolve = done }); const old = list.load(2)
    auth.logout(); resolve(json([fixture(999)])); await old; assert.deepEqual(list.orders.value, [])
  })
  await check('admin redirects require known route and valid order id', () => {
    assert.deepEqual(loginDestination({ next: 'admin-orders' }), { name: 'admin-orders' })
    assert.deepEqual(loginReturnQuery({ name: 'admin-order-details', params: { orderId: '99' } }), { next: 'admin-order-details', orderId: '99' })
    assert.deepEqual(loginDestination({ next: 'admin-order-details', orderId: '99' }), { name: 'admin-order-details', params: { orderId: '99' } })
    assert.deepEqual(loginDestination({ next: 'admin-order-details', orderId: '../99' }), { name: 'account' })
  })
  console.log(`Admin order checks: ${passed} passed. No real orders or status changes.`)
} finally {
  scopes.forEach((scope) => scope.stop()); notifications?.$dispose(); auth?.$dispose(); globalThis.fetch = originalFetch
  if (originalStorage) { Object.defineProperty(globalThis, 'sessionStorage', originalStorage) } else { delete globalThis.sessionStorage }
  await server.close()
}
