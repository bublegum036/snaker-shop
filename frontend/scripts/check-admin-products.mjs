// Изолированные ответы API: реальные товары, аккаунты и роли не изменяются.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} } })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const flush = () => new Promise((resolve) => setImmediate(resolve))
const profile = { id: 9001, email: 'fixture@example.com', is_admin: true }
const credentials = { email: profile.email, password: 'fixture-only' }
const brands = [{ id: 1, name: 'Fixture brand' }]
const body = { name: 'Fixture product', brand_id: 1, price: '7990.00', description: '', image_url: null }
const product = (id) => ({ id, version: 1, ...body, name: `Fixture product ${id}`, sizes: [] })
let auth, state, notifications, handler, dataset, user, calls, writes, scope, testPinia, passed = 0
let code, loseResponse, failRefresh

globalThis.fetch = (url, init) => handler(String(url), init)
try {
  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth/auth.store.ts')
  const { useNotificationsStore } = await server.ssrLoadModule('/src/stores/notifications/notifications.store.ts')
  const { useAdminProducts } = await server.ssrLoadModule('/src/composables/admin/useAdminProducts/useAdminProducts.ts')
  const { getProducts } = await server.ssrLoadModule('/src/api/catalog.api.ts')
  const { productBody, productDraft } = await server.ssrLoadModule('/src/components/admin/AdminProductForm/AdminProductForm.model.ts')
  const { sessionGuard } = await server.ssrLoadModule('/src/router/session-guard.ts')
  const { watchSessionNavigation } = await server.ssrLoadModule('/src/router/session-navigation.ts')
  const { loginDestination, loginReturnQuery } = await server.ssrLoadModule('/src/router/auth-redirect.ts')
  function defaultHandler(url, init) {
    if (url === '/api/auth/login') { return Promise.resolve(json({ access_token: 'fixture-token', token_type: 'bearer' })) }
    if (url === '/api/auth/me') { return Promise.resolve(json(user)) }
    assert.equal(init.headers.get('Authorization'), 'Bearer fixture-token')
    calls.push(url)
    const parsed = new URL(url, 'http://fixture.local')
    if (!init.method) {
      if (failRefresh) { return Promise.reject(new TypeError('offline')) }
      if (parsed.pathname === '/api/brands') { return Promise.resolve(json(brands)) }
      assert.equal(parsed.pathname, '/api/products')
      const offset = Number(parsed.searchParams.get('offset'))
      const limit = Number(parsed.searchParams.get('limit'))
      return Promise.resolve(json(dataset.slice(offset, offset + limit)))
    }
    writes.push({ url, method: init.method, body: init.body && JSON.parse(init.body) })
    if (code) { return Promise.resolve(json({ detail: code === 409 ? 'Product is referenced by a cart or order' : 'rejected' }, code)) }
    const id = Number(parsed.pathname.split('/').at(-1))
    let result
    if (init.method === 'POST') {
      assert.equal(url, '/api/products')
      assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(), ['brand_id', 'description', 'image_url', 'name', 'price'])
      result = { id: Math.max(...dataset.map((item) => item.id), 0) + 1, ...JSON.parse(init.body), sizes: [] }
      dataset.push(result)
    } else if (init.method === 'PUT') {
      const current = dataset.find((item) => item.id === id)
      const input = JSON.parse(init.body)
      if (input.version !== current.version) { return Promise.resolve(json({ detail: 'product_version_conflict' }, 409)) }
      result = { ...current, ...input, version: current.version + 1 }
      dataset = dataset.map((item) => item.id === id ? result : item)
    } else {
      assert.equal(init.method, 'DELETE'); assert.equal(init.body, undefined)
      dataset = dataset.filter((item) => item.id !== id)
    }
    if (loseResponse) { return Promise.reject(new TypeError('lost response')) }
    return Promise.resolve(init.method === 'DELETE' ? new Response(null, { status: 204 }) : json(result, init.method === 'POST' ? 201 : 200))
  }
  function setup() {
    scope?.stop(); notifications?.$dispose(); auth?.$dispose(); testPinia = createPinia(); setActivePinia(testPinia)
    auth = useAuthStore(); notifications = useNotificationsStore(); dataset = Array.from({ length: 12 }, (_, index) => product(index + 1))
    user = { ...profile }; calls = []; writes = []; code = undefined; loseResponse = false; failRefresh = false
    handler = defaultHandler
  }
  function mount() { scope = effectScope(); state = scope.run(useAdminProducts); return state }
  async function fresh() { setup(); await auth.login(credentials); mount(); await flush(); return state }
  function router() {
    const component = { render: () => null }
    const result = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/', name: 'catalog', component },
      { path: '/login', name: 'login', component, meta: { guestOnly: true } },
      { path: '/account', name: 'account', component, meta: { requiresAuth: true } },
      { path: '/admin/products', name: 'admin-products', component, meta: { requiresAuth: true, requiresAdmin: true } },
    ] })
    result.beforeEach(sessionGuard); return result
  }
  async function check(name, run) { await run(); passed++; console.log(`OK: ${name}`) }

  await check('guest cannot load or write admin catalog', async () => {
    setup(); mount(); await flush(); state.openEditor(); assert.equal(await state.save(body), false)
    assert.equal(calls.length, 0); assert.equal(writes.length, 0)
  })
  await check('customer cannot open editor or send writes', async () => {
    setup(); user.is_admin = false; await auth.login(credentials); mount(); await flush()
    state.openEditor(); state.requestDelete(product(1))
    assert.equal(state.editorOpen.value, false); assert.equal(await state.confirmDelete(), false); assert.equal(calls.length, 0)
  })
  await check('admin loads paginated catalog and existing brand types', async () => {
    await fresh(); assert.ok(calls.includes('/api/products?limit=11&offset=0'))
    assert.equal(state.products.value.length, 10); assert.equal(state.hasNextPage.value, true); assert.deepEqual(state.brands.value, brands)
    await state.load(2); assert.equal(state.products.value.length, 2); assert.equal(state.hasNextPage.value, false)
    assert.ok(calls.includes('/api/products?limit=11&offset=10'))
  })
  await check('failed list refresh blocks stale writes until recovery', async () => {
    await fresh(); failRefresh = true; await state.load(2)
    assert.equal(state.page.value, 1); assert.equal(state.requestedPage.value, 2); assert.equal(state.canWrite.value, false)
    failRefresh = false; await state.load(state.requestedPage.value)
    assert.equal(state.page.value, 2); assert.equal(state.canWrite.value, true)
  })
  await check('missing brands disable form actions', async () => {
    setup(); await auth.login(credentials)
    handler = (url, init) => url === '/api/brands' ? Promise.resolve(json([])) : defaultHandler(url, init)
    mount(); await flush(); assert.equal(state.products.value.length, 10)
    assert.equal(state.canWrite.value, false); state.openEditor(); assert.equal(state.editorOpen.value, false)
  })
  await check('shared catalog query preserves public filters and zero price', async () => {
    setup(); handler = async (url) => {
      const params = new URL(url, 'http://fixture.local').searchParams
      assert.equal(params.get('search'), 'North & City'); assert.equal(params.get('min_price'), '0')
      assert.equal(params.get('brand_id'), '1'); assert.equal(params.get('size'), '42')
      assert.equal(params.get('limit'), '13'); assert.equal(params.get('offset'), '12')
      return json([product(1)])
    }
    const result = await getProducts({ search: 'North & City', min_price: 0, brand_id: 1, size: 42, limit: 13, offset: 12 })
    assert.equal(result[0].id, 1)
  })
  await check('form keeps exact decimal string and normalizes comma', async () => {
    const draft = { ...productDraft(null), name: '  New sneaker  ', brandId: '1', price: '000012,30' }
    assert.deepEqual(productBody(draft, brands), { ...body, name: 'New sneaker', price: '12.30' })
    assert.equal(productBody({ ...draft, price: '99999999.99' }, brands).price, '99999999.99')
    assert.equal(productBody({ ...draft, price: '0.01' }, brands).price, '0.01')
  })
  await check('invalid form fields cannot produce a request body', async () => {
    const draft = { name: 'Valid', brandId: '1', price: '10.00', description: '', imageUrl: '' }
    for (const price of ['0', '-1', '1e2', 'Infinity', '1.234', '100000000.00', '', '.01']) { assert.throws(() => productBody({ ...draft, price }, brands)) }
    for (const patch of [{ name: ' ' }, { name: 'a'.repeat(121) }, { brandId: '999' }, { description: 'a'.repeat(2001) }, { imageUrl: 'javascript:alert(1)' }, { imageUrl: 'bad-url' }]) {
      assert.throws(() => productBody({ ...draft, ...patch }, brands))
    }
  })
  await check('create sends only write fields and refreshes list', async () => {
    await fresh(); state.openEditor(); assert.equal(await state.save(body), true)
    assert.equal(writes[0].method, 'POST'); assert.equal(dataset.length, 13)
    assert.match((notifications.current?.message ?? ''), /создан/); assert.equal(state.editorOpen.value, false); assert.equal(state.error.value, '')
  })
  await check('edit prefill is independent from server object and uses PUT', async () => {
    await fresh(); const original = state.products.value[0]; const draft = productDraft(original); draft.name = 'Changed'
    assert.notEqual(original.name, draft.name); state.openEditor(original)
    assert.equal(await state.save(productBody(draft, brands)), true)
    assert.equal(writes[0].url, '/api/products/1'); assert.equal(writes[0].method, 'PUT')
    assert.equal(state.products.value[0].name, 'Changed'); assert.equal(writes[0].body.version, 1); assert.equal(state.products.value[0].version, 2)
  })
  await check('stale form cannot overwrite a concurrent price and requires reopening', async () => {
    await fresh(); state.openEditor(state.products.value[0])
    dataset[0] = { ...dataset[0], price: '9000.00', version: 2 }
    assert.equal(await state.save({ ...body, description: 'My description' }), false)
    assert.equal(dataset[0].price, '9000.00'); assert.equal(dataset[0].description, '')
    assert.match(state.error.value, /другим администратором/)
    assert.equal(state.requiresReload.value, true); assert.equal(state.editorOpen.value, false)
    assert.equal(writes.length, 1)
    await state.load(); state.openEditor(state.products.value[0])
    assert.equal(await state.save({ ...body, price: '9000.00', description: 'My description' }), true)
    assert.equal(writes[1].body.version, 2); assert.equal(dataset[0].price, '9000.00')
  })
  await check('delete requires a selected confirmation and accepts empty 204', async () => {
    await fresh(); assert.equal(await state.confirmDelete(), false); assert.equal(writes.length, 0)
    state.requestDelete(state.products.value[0]); state.cancelDelete(); assert.equal(await state.confirmDelete(), false)
    state.requestDelete(state.products.value[0]); assert.equal(await state.confirmDelete(), true)
    assert.equal(writes[0].method, 'DELETE'); assert.equal(dataset.some((item) => item.id === 1), false)
  })
  await check('opening and canceling deletion preserves the editor and its layout', async () => {
    await fresh(); state.openEditor(state.products.value[0])
    const original = state.editing.value
    state.requestDelete(state.products.value[1]); assert.equal(state.editorOpen.value, true)
    state.cancelDelete(); assert.equal(state.editorOpen.value, true); assert.equal(state.editing.value, original)
    assert.equal(writes.length, 0)
  })
  await check('referenced product conflict is explained and requires reload', async () => {
    await fresh(); code = 409; state.requestDelete(state.products.value[0]); await state.confirmDelete()
    assert.match(state.error.value, /использоваться в корзине или заказе/)
    assert.equal(state.requiresReload.value, true); assert.equal(dataset.length, 12); assert.equal(state.canWrite.value, false)
    code = undefined; await state.load(); assert.equal(state.canWrite.value, true)
  })
  await check('validation rejection keeps draft editor available for correction', async () => {
    await fresh(); code = 422; state.openEditor(); await state.save(body)
    assert.equal(state.editorOpen.value, true); assert.equal(state.canWrite.value, true); assert.match(state.error.value, /Проверьте название/)
  })
  await check('stale product 404 requires list refresh', async () => {
    await fresh(); code = 404; state.openEditor(state.products.value[0]); await state.save(body)
    assert.match(state.error.value, /больше не найден/); assert.equal(state.requiresReload.value, true)
  })
  await check('lost POST response is never auto-repeated and closes form', async () => {
    await fresh(); loseResponse = true; state.openEditor(); assert.equal(await state.save(body), false)
    assert.equal(dataset.length, 13); assert.equal(writes.length, 1); assert.equal(state.editorOpen.value, false)
    assert.equal(state.requiresReload.value, true); assert.match(state.error.value, /Результат записи неизвестен/)
    assert.equal(notifications.current, null)
    assert.equal(await state.save(body), false); loseResponse = false; await state.load()
    assert.equal(writes.length, 1); assert.equal(state.canWrite.value, true)
  })
  await check('confirmed POST and failed GET keep success separate from refresh error', async () => {
    await fresh(); state.openEditor()
    handler = async (url, init) => { const result = await defaultHandler(url, init); if (init.method === 'POST') { failRefresh = true; } return result }
    assert.equal(await state.save(body), true); assert.equal(writes.length, 1)
    assert.match((notifications.current?.message ?? ''), /создан/); assert.match(state.error.value, /Запись подтверждена/)
    assert.equal(state.canWrite.value, false); assert.equal(await state.save(body), false)
    failRefresh = false; handler = defaultHandler; await state.load(); assert.equal(writes.length, 1)
  })
  await check('parallel writes and editor switches are blocked', async () => {
    await fresh(); let resolve; state.openEditor()
    handler = (url, init) => init.method === 'POST' ? new Promise((done) => { resolve = done }) : defaultHandler(url, init)
    const request = state.save(body); assert.equal(await state.save(body), false)
    state.requestDelete(product(1)); assert.equal(state.deleting.value, null)
    resolve(json({ id: 13, ...body, sizes: [] }, 201)); await request
  })
  await check('403 disables actions until role is checked again', async () => {
    await fresh(); code = 403; state.openEditor(); await state.save(body)
    assert.equal(state.accessDenied.value, true); assert.equal(state.canWrite.value, false)
    user.is_admin = false; await state.load(); assert.equal(state.isAdmin.value, false); assert.equal(auth.isAuthenticated, true)
  })
  await check('401 clears session and admin drafts', async () => {
    await fresh(); code = 401; state.openEditor(); await state.save(body)
    assert.equal(auth.isAuthenticated, false); assert.equal(state.editorOpen.value, false); assert.deepEqual(state.products.value, [])
  })
  await check('logout discards a late write response', async () => {
    await fresh(); let resolve; state.openEditor()
    handler = () => new Promise((done) => { resolve = done })
    const request = state.save(body); auth.logout(); resolve(json({ id: 13, ...body, sizes: [] }, 201))
    assert.equal(await request, false); assert.equal((notifications.current?.message ?? ''), ''); assert.deepEqual(state.products.value, [])
  })
  await check('new session cannot receive older catalog response', async () => {
    await fresh(); const resolvers = []; handler = () => new Promise((done) => { resolvers.push(done) })
    const old = state.load(2); auth.logout(); handler = defaultHandler; user = { ...profile, id: 9002 }
    dataset = [product(50)]; await auth.login(credentials); await flush()
    resolvers[0](json([product(99)])); resolvers[1](json(brands)); await old
    assert.equal(state.products.value[0].id, 50)
  })
  await check('leaving page aborts pending reads and writes', async () => {
    await fresh(); let resolve, signal; state.openEditor()
    handler = (url, init) => { signal = init.signal; return new Promise((done) => { resolve = done }) }
    const request = state.save(body); scope.stop(); assert.equal(signal.aborted, true)
    resolve(json({ id: 13, ...body, sizes: [] }, 201)); assert.equal(await request, false); assert.equal((notifications.current?.message ?? ''), '')
  })
  await check('guard returns guest to requested admin page after login', async () => {
    setup(); const navigation = router(); await navigation.push('/admin/products')
    assert.equal(navigation.currentRoute.value.name, 'login'); assert.equal(navigation.currentRoute.value.query.next, 'admin-products')
    assert.deepEqual(loginDestination({ next: 'admin-products' }), { name: 'admin-products' })
    assert.deepEqual(loginReturnQuery({ name: 'admin-products', params: {} }), { next: 'admin-products' })
  })
  await check('guard rejects customer and allows administrator', async () => {
    setup(); user.is_admin = false; await auth.login(credentials)
    const navigation = router(); await navigation.push('/admin/products')
    assert.equal(navigation.currentRoute.value.name, 'account'); assert.equal(navigation.currentRoute.value.query.access, 'admin-required')
    user.is_admin = true; await auth.refreshProfile(); await navigation.push('/admin/products')
    assert.equal(navigation.currentRoute.value.name, 'admin-products')
  })
  await check('role revocation leaves open admin route and clears local state', async () => {
    await fresh(); const navigation = router(); await navigation.push('/admin/products')
    const stop = watchSessionNavigation(navigation, testPinia)
    try {
      user.is_admin = false; await auth.refreshProfile(); await flush()
      assert.equal(navigation.currentRoute.value.name, 'account'); assert.equal(state.isAdmin.value, false); assert.deepEqual(state.products.value, [])
    } finally { stop() }
  })
  console.log(`Admin product checks: ${passed} passed. No real products or accounts changed.`)
} finally {
  scope?.stop(); notifications?.$dispose(); auth?.$dispose(); globalThis.fetch = originalFetch
  if (originalStorage) { Object.defineProperty(globalThis, 'sessionStorage', originalStorage) } else { delete globalThis.sessionStorage }
  await server.close()
}
