// Фиктивные HTTP-ответы: рабочая БД, аккаунты и заказы не меняются.
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
const profile = { id: 9001, email: 'fixture@example.com', is_admin: false }
const credentials = { email: profile.email, password: 'fixture-only' }
const fixture = (id, userId = profile.id) => ({ id, user_id: userId, status: 'processing', total: '7990.00', created_at: '2026-10-15T12:00:00Z', items: [{ id: 1, product_size_id: 302, quantity: 1, price_at_purchase: '7990.00' }] })
let auth, handler, dataset, calls, user, scopes = [], passed = 0
const mount = (factory) => { const scope = effectScope(); scopes.push(scope); return { scope, state: scope.run(factory) } }
globalThis.fetch = (url, init) => handler(String(url), init)
try {
  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth/auth.store.ts')
  const { useOrderHistory } = await server.ssrLoadModule('/src/composables/orders/useOrderHistory/useOrderHistory.ts')
  const { useOrderDetails } = await server.ssrLoadModule('/src/composables/orders/useOrderDetails/useOrderDetails.ts')
  const { loginDestination, loginReturnQuery } = await server.ssrLoadModule('/src/router/auth-redirect.ts')
  function defaultHandler(url, init) {
    if (url === '/api/auth/login') return Promise.resolve(json({ access_token: 'fixture-token', token_type: 'bearer' }))
    if (url === '/api/auth/me') return Promise.resolve(json(user))
    assert.equal(init.headers.get('Authorization'), 'Bearer fixture-token')
    assert.equal(init.method, undefined)
    calls.push(url)
    const parsed = new URL(url, 'http://fixture.local')
    if (parsed.pathname === '/api/orders') {
      const offset = Number(parsed.searchParams.get('offset'))
      const limit = Number(parsed.searchParams.get('limit'))
      return Promise.resolve(json(dataset.slice(offset, offset + limit)))
    }
    const order = dataset.find((value) => value.id === Number(parsed.pathname.split('/').at(-1)))
    return Promise.resolve(order ? json(order) : json({ detail: 'order_not_found' }, 404))
  }
  function setup() {
    scopes.forEach((scope) => scope.stop()); scopes = []
    auth?.$dispose(); setActivePinia(createPinia()); auth = useAuthStore()
    user = profile; dataset = Array.from({ length: 25 }, (_, index) => fixture(100 - index)); calls = []
    handler = defaultHandler
  }
  async function fresh() { setup(); await auth.login(credentials) }
  async function check(name, run) { await run(); passed++; console.log(`OK: ${name}`) }

  await check('guest does not request history or details', async () => {
    setup()
    const history = mount(useOrderHistory).state
    const details = mount(() => useOrderDetails(() => '100')).state
    await flush(); assert.equal(calls.length, 0); assert.deepEqual(history.orders.value, []); assert.equal(details.order.value, null)
  })
  await check('history loads ten rows plus lookahead using server ordering', async () => {
    await fresh(); const history = mount(useOrderHistory).state; await flush()
    assert.equal(calls[0], '/api/orders?limit=11&offset=0')
    assert.equal(history.orders.value.length, 10); assert.equal(history.orders.value[0].id, 100)
    assert.equal(history.hasNextPage.value, true)
  })
  await check('pagination advances offsets and stops on the final page', async () => {
    await fresh(); const history = mount(useOrderHistory).state; await flush()
    await history.load(2); assert.equal(calls.at(-1), '/api/orders?limit=11&offset=10'); assert.equal(history.page.value, 2)
    await history.load(3); assert.equal(calls.at(-1), '/api/orders?limit=11&offset=20')
    assert.equal(history.orders.value.length, 5); assert.equal(history.hasNextPage.value, false)
    await history.load(0); assert.equal(calls.length, 3)
  })
  await check('failed next page retains confirmed page and retries requested page', async () => {
    await fresh(); const history = mount(useOrderHistory).state; await flush()
    handler = () => Promise.resolve(json({}, 503)); await history.load(2)
    assert.equal(history.page.value, 1); assert.equal(history.requestedPage.value, 2); assert.ok(history.error.value)
    handler = defaultHandler; await history.load(history.requestedPage.value)
    assert.equal(history.page.value, 2); assert.equal(history.error.value, '')
  })
  await check('empty history is a successful empty state', async () => {
    await fresh(); dataset = []; const history = mount(useOrderHistory).state; await flush()
    assert.deepEqual(history.orders.value, []); assert.equal(history.error.value, ''); assert.equal(history.hasNextPage.value, false)
  })
  await check('stale history response cannot replace a newer page', async () => {
    await fresh(); const history = mount(useOrderHistory).state; await flush()
    let resolve; handler = () => new Promise((done) => { resolve = done })
    const old = history.load(2); handler = defaultHandler; await history.load(3)
    resolve(json([fixture(999)])); await old
    assert.equal(history.page.value, 3); assert.equal(history.orders.value[0].id, 80)
  })
  await check('logout clears both resources and discards delayed responses', async () => {
    await fresh()
    const history = mount(useOrderHistory).state; const details = mount(() => useOrderDetails(() => '100')).state; await flush()
    let resolvers = []; handler = () => new Promise((done) => resolvers.push(done))
    const oldHistory = history.load(); const oldDetail = details.load(); auth.logout()
    resolvers[0](json([fixture(100)])); resolvers[1](json(fixture(100)))
    await Promise.all([oldHistory, oldDetail])
    assert.deepEqual(history.orders.value, []); assert.equal(details.order.value, null); assert.equal(history.error.value, '')
  })
  await check('new user receives fresh history and no old details', async () => {
    await fresh(); const history = mount(useOrderHistory).state; const details = mount(() => useOrderDetails(() => '100')).state; await flush()
    auth.logout(); user = { ...profile, id: 9002 }; dataset = [fixture(200, user.id)]
    await auth.login(credentials); await flush()
    assert.equal(history.orders.value[0].user_id, 9002); assert.equal(details.order.value, null)
    assert.match(details.error.value, /не найден или недоступен/)
  })
  await check('detail uses stored purchase price and does not query catalog', async () => {
    await fresh(); const details = mount(() => useOrderDetails(() => '100')).state; await flush()
    assert.deepEqual(calls, ['/api/orders/100']); assert.equal(details.order.value.items[0].price_at_purchase, '7990.00')
    assert.equal(details.order.value.status, 'processing')
  })
  await check('missing or foreign order gets a neutral 404 message', async () => {
    await fresh(); const details = mount(() => useOrderDetails(() => '999')).state; await flush()
    assert.equal(details.order.value, null); assert.match(details.error.value, /не найден или недоступен вашему аккаунту/)
    assert.equal(auth.isAuthenticated, true)
  })
  await check('invalid order ids never reach API', async () => {
    await fresh(); const id = ref('0'); const details = mount(() => useOrderDetails(() => id.value)).state
    for (const value of ['0', '-1', '1.5', '2147483648', '1e2', '../100', 'abc', '']) {
      id.value = value; await flush(); assert.match(details.error.value, /Некорректный номер/)
    }
    assert.equal(calls.length, 0)
  })
  await check('changing route id cancels old order and loads the new one', async () => {
    await fresh(); const id = ref('100'); const details = mount(() => useOrderDetails(() => id.value)).state; await flush()
    let resolve; handler = () => new Promise((done) => { resolve = done })
    const old = details.load(); handler = defaultHandler; id.value = '99'; await flush()
    resolve(json(fixture(100))); await old; assert.equal(details.order.value.id, 99)
  })
  await check('leaving page cancels reads and ignores late results', async () => {
    await fresh(); let resolve, signal
    handler = (url, init) => { signal = init.signal; return new Promise((done) => { resolve = done }) }
    const { scope, state } = mount(useOrderHistory); scope.stop(); assert.equal(signal.aborted, true)
    resolve(json([fixture(100)])); await flush(); assert.deepEqual(state.orders.value, [])
  })
  await check('401 ends session and clears loaded orders', async () => {
    await fresh(); const history = mount(useOrderHistory).state; await flush()
    handler = () => Promise.resolve(json({}, 401)); await history.load()
    assert.equal(auth.isAuthenticated, false); assert.deepEqual(history.orders.value, [])
  })
  await check('403 retains session and read can be retried', async () => {
    await fresh(); handler = () => Promise.resolve(json({}, 403))
    const details = mount(() => useOrderDetails(() => '100')).state; await flush()
    assert.equal(auth.isAuthenticated, true); assert.ok(details.error.value)
    handler = defaultHandler; await details.load(); assert.equal(details.order.value.id, 100)
  })
  await check('login returns to known orders route with validated id', async () => {
    assert.deepEqual(loginReturnQuery({ name: 'order-details', params: { orderId: '100' } }), { next: 'order-details', orderId: '100' })
    assert.deepEqual(loginDestination({ next: 'order-details', orderId: '100' }), { name: 'order-details', params: { orderId: '100' } })
    assert.deepEqual(loginDestination({ next: 'orders' }), { name: 'orders' })
    assert.deepEqual(loginReturnQuery({ name: 'orders', params: {} }), { next: 'orders' })
    for (const query of [{ next: 'https://example.com' }, { next: 'order-details', orderId: '../100' }, { next: ['orders'] }, { next: 'order-details', orderId: ['100'] }]) {
      assert.deepEqual(loginDestination(query), { name: 'account' })
    }
  })
  console.log(`Order checks: ${passed} passed. No real orders or database changes.`)
} finally {
  scopes.forEach((scope) => scope.stop()); auth?.$dispose()
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else delete globalThis.sessionStorage
  await server.close()
}
