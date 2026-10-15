// Изолированная проверка: рабочие товары и остатки не изменяются.
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
const makeProduct = (id) => ({ id, name: `Fixture ${id}`, brand_id: 1, price: '5000.00', description: '', image_url: null, sizes: [{ id: 101, size: '42.0', stock: 3 }] })
let auth, notifications, scope, state, id, user, dataset, handler, writes, reads, failure, failRead, loseResponse, passed = 0

globalThis.fetch = (url, init) => handler(String(url), init)
try {
  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth/auth.store.ts')
  const { useNotificationsStore } = await server.ssrLoadModule('/src/stores/notifications/notifications.store.ts')
  const { useAdminInventory } = await server.ssrLoadModule('/src/composables/admin/useAdminInventory/useAdminInventory.ts')
  const { sizeBody, sizeDraft } = await server.ssrLoadModule('/src/components/admin/AdminSizeForm/AdminSizeForm.model.ts')
  const { loginDestination, loginReturnQuery } = await server.ssrLoadModule('/src/router/auth-redirect.ts')
  function defaultHandler(url, init) {
    if (url === '/api/auth/login') return Promise.resolve(json({ access_token: 'fixture-token', token_type: 'bearer' }))
    if (url === '/api/auth/me') return Promise.resolve(json(user))
    assert.equal(init.headers.get('Authorization'), 'Bearer fixture-token')
    if (!init.method) {
      reads.push(url)
      if (failRead) return Promise.reject(new TypeError('offline'))
      const product = dataset.find((value) => `/api/products/${value.id}` === url)
      return Promise.resolve(product ? json(product) : json({ detail: 'Product not found' }, 404))
    }
    const path = url.match(/^\/api\/products\/(\d+)\/sizes(?:\/(\d+))?$/)
    assert.ok(path)
    const product = dataset.find((value) => value.id === Number(path[1]))
    const body = init.body && JSON.parse(init.body)
    writes.push({ url, method: init.method, body })
    if (failure) return Promise.resolve(json({ detail: failure.code }, failure.status))
    if (!product) return Promise.resolve(json({ detail: 'product_not_found' }, 404))
    let result
    if (init.method === 'POST') {
      assert.deepEqual(Object.keys(body).sort(), ['size', 'stock'])
      if (product.sizes.some((size) => Number(size.size) === Number(body.size))) return Promise.resolve(json({ detail: 'size_already_exists' }, 409))
      result = { id: 102, ...body }; product.sizes.push(result)
    } else {
      const existing = product.sizes.find((value) => value.id === Number(path[2]))
      if (!existing) return Promise.resolve(json({ detail: 'size_not_found' }, 404))
      if (init.method === 'PATCH') { Object.assign(existing, body); result = existing }
      else { assert.equal(init.method, 'DELETE'); assert.equal(init.body, undefined); product.sizes = product.sizes.filter((value) => value !== existing) }
    }
    if (loseResponse) return Promise.reject(new TypeError('response lost'))
    return Promise.resolve(init.method === 'DELETE' ? new Response(null, { status: 204 }) : json(result, init.method === 'POST' ? 201 : 200))
  }
  function setup() {
    scope?.stop(); notifications?.$dispose(); auth?.$dispose(); setActivePinia(createPinia())
    auth = useAuthStore(); notifications = useNotificationsStore(); id = ref('10')
    user = { ...profile }; dataset = [makeProduct(10), makeProduct(20)]; writes = []; reads = []
    failure = undefined; failRead = false; loseResponse = false; handler = defaultHandler
  }
  function mount() { scope = effectScope(); state = scope.run(() => useAdminInventory(() => id.value)) }
  async function fresh() { setup(); await auth.login(credentials); mount(); await flush() }
  async function check(name, run) { await run(); passed++; console.log(`OK: ${name}`) }

  await check('guest and customer do not load or write inventory', async () => {
    setup(); mount(); await flush(); assert.equal(reads.length, 0); assert.equal(await state.save({ size: '43.0', stock: 0 }), false)
    scope.stop(); user.is_admin = false; await auth.login(credentials); mount(); await flush()
    state.openEditor(); assert.equal(state.editorOpen.value, false); assert.equal(writes.length, 0); assert.equal(reads.length, 0)
  })
  await check('admin loads selected product and sizes', async () => {
    await fresh(); assert.deepEqual(reads, ['/api/products/10']); assert.equal(state.product.value.sizes[0].stock, 3)
  })
  await check('form accepts zero stock and one decimal size', () => {
    assert.deepEqual(sizeBody({ size: '042,5', stock: 0 }), { size: '42.5', stock: 0 })
    assert.deepEqual(sizeBody({ size: '999', stock: 2147483647 }), { size: '999.0', stock: 2147483647 })
    assert.deepEqual(sizeDraft(null), { size: '', stock: 0 })
  })
  await check('invalid size and stock cannot produce a body', () => {
    for (const size of ['0', '-1', '999.1', '1000', '42.12', '1e2', 'Infinity', '', '.5']) assert.throws(() => sizeBody({ size, stock: 0 }))
    for (const stock of [-1, 1.5, 2147483648, NaN, Infinity, '', '2']) assert.throws(() => sizeBody({ size: '42', stock }))
  })
  await check('add size sends product scoped POST and refreshes authoritative data', async () => {
    await fresh(); state.openEditor(); assert.equal(await state.save({ size: '43.0', stock: 0 }), true)
    assert.equal(writes[0].url, '/api/products/10/sizes'); assert.equal(writes[0].method, 'POST')
    assert.equal(state.product.value.sizes[1].stock, 0); assert.match(notifications.current.message, /добавлен/)
  })
  await check('stock edit sends absolute quantity without unchanged size', async () => {
    await fresh(); state.openEditor(state.product.value.sizes[0]); await state.save({ size: '42', stock: 5 })
    assert.deepEqual(writes[0].body, { stock: 5 }); assert.equal(writes[0].method, 'PATCH')
    assert.equal(writes[0].url, '/api/products/10/sizes/101'); assert.equal(state.product.value.sizes[0].stock, 5)
  })
  await check('size only edit does not overwrite stock changed by another purchase', async () => {
    await fresh(); state.openEditor(state.product.value.sizes[0]); dataset[0].sizes[0].stock = 1
    await state.save({ size: '42.5', stock: 3 })
    assert.deepEqual(writes[0].body, { size: '42.5' }); assert.equal(state.product.value.sizes[0].stock, 1)
  })
  await check('unchanged form does not send empty PATCH', async () => {
    await fresh(); state.openEditor(state.product.value.sizes[0]); assert.equal(await state.save({ size: '42', stock: 3 }), false)
    assert.equal(writes.length, 0)
  })
  await check('size can be set out of stock with zero', async () => {
    await fresh(); state.openEditor(state.product.value.sizes[0]); await state.save({ size: '42.0', stock: 0 })
    assert.deepEqual(writes[0].body, { stock: 0 }); assert.equal(state.product.value.sizes[0].stock, 0)
  })
  await check('delete requires confirmation and handles empty 204', async () => {
    await fresh(); assert.equal(await state.confirmDelete(), false)
    state.requestDelete(state.product.value.sizes[0]); state.cancelDelete(); assert.equal(await state.confirmDelete(), false)
    state.requestDelete(state.product.value.sizes[0]); assert.equal(await state.confirmDelete(), true)
    assert.equal(writes[0].method, 'DELETE'); assert.deepEqual(state.product.value.sizes, [])
  })
  await check('canceling delete keeps current editor open', async () => {
    await fresh(); state.openEditor(state.product.value.sizes[0]); state.requestDelete(state.product.value.sizes[0]); state.cancelDelete()
    assert.equal(state.editorOpen.value, true); assert.equal(writes.length, 0)
  })
  await check('duplicate size keeps draft available for correction', async () => {
    await fresh(); state.openEditor(); await state.save({ size: '42.0', stock: 1 })
    assert.match(state.error.value, /уже есть такой размер/); assert.equal(state.editorOpen.value, true)
    assert.equal(state.canWrite.value, true); assert.equal(notifications.current, null)
  })
  await check('referenced size cannot rename but can subsequently change stock', async () => {
    await fresh(); failure = { status: 409, code: 'size_referenced' }; state.openEditor(state.product.value.sizes[0])
    await state.save({ size: '43.0', stock: 3 }); assert.match(state.error.value, /остаток можно изменить/)
    assert.equal(state.canWrite.value, true); failure = undefined; await state.save({ size: '42.0', stock: 5 })
    assert.deepEqual(writes.at(-1).body, { stock: 5 })
  })
  await check('referenced size deletion closes confirmation and explains restriction', async () => {
    await fresh(); failure = { status: 409, code: 'size_referenced' }; state.requestDelete(state.product.value.sizes[0]); await state.confirmDelete()
    assert.equal(state.deleting.value, null); assert.match(state.error.value, /нельзя переименовать или удалить/)
    assert.equal(state.product.value.sizes.length, 1)
  })
  await check('422 keeps editor available and 404 requires reload', async () => {
    await fresh(); state.openEditor(); failure = { status: 422, code: 'invalid_size_data' }; await state.save({ size: '43.0', stock: 1 })
    assert.equal(state.editorOpen.value, true); failure = { status: 404, code: 'product_not_found' }; await state.save({ size: '43.0', stock: 1 })
    assert.equal(state.requiresReload.value, true); assert.equal(state.canWrite.value, false)
  })
  await check('concurrent change requires refresh before explicit retry', async () => {
    await fresh(); failure = { status: 409, code: 'concurrent_change_retry' }; state.openEditor(); await state.save({ size: '43.0', stock: 1 })
    assert.match(state.error.value, /другим запросом/); assert.equal(state.canWrite.value, false)
    failure = undefined; await state.load(); assert.equal(state.canWrite.value, true)
  })
  await check('uncertain POST is not repeated and is reconciled by GET', async () => {
    await fresh(); loseResponse = true; state.openEditor(); assert.equal(await state.save({ size: '43.0', stock: 1 }), false)
    assert.equal(dataset[0].sizes.length, 2); assert.equal(state.canWrite.value, false); assert.equal(notifications.current, null)
    assert.equal(await state.save({ size: '43.0', stock: 1 }), false); loseResponse = false; await state.load()
    assert.equal(state.product.value.sizes.length, 2); assert.equal(writes.length, 1)
  })
  await check('confirmed write with failed refresh retains success and blocks new writes', async () => {
    await fresh(); state.openEditor()
    handler = async (url, init) => { const result = await defaultHandler(url, init); if (init.method === 'POST') failRead = true; return result }
    assert.equal(await state.save({ size: '43.0', stock: 1 }), true)
    assert.match(notifications.current.message, /добавлен/); assert.match(state.error.value, /Запись подтверждена/)
    assert.equal(state.product.value, null); assert.equal(state.canWrite.value, false)
    failRead = false; handler = defaultHandler; await state.load(); assert.equal(writes.length, 1)
  })
  await check('parallel writes and editor changes are blocked', async () => {
    await fresh(); let resolve; state.openEditor()
    handler = (url, init) => init.method ? new Promise((done) => { resolve = done }) : defaultHandler(url, init)
    const pending = state.save({ size: '43.0', stock: 1 }); assert.equal(await state.save({ size: '44.0', stock: 1 }), false)
    state.requestDelete(state.product.value.sizes[0]); assert.equal(state.deleting.value, null)
    resolve(json({ id: 102, size: '43.0', stock: 1 }, 201)); await pending
  })
  await check('401 clears session and inventory state', async () => {
    await fresh(); failure = { status: 401, code: 'unknown_user' }; state.openEditor(); await state.save({ size: '43.0', stock: 1 })
    assert.equal(auth.isAuthenticated, false); assert.equal(state.product.value, null); assert.equal(state.editorOpen.value, false)
  })
  await check('403 blocks actions and verifies role on retry', async () => {
    await fresh(); failure = { status: 403, code: 'admin_required' }; state.openEditor(); await state.save({ size: '43.0', stock: 1 })
    assert.equal(state.accessDenied.value, true); user.is_admin = false; await state.load(); assert.equal(state.isAdmin.value, false)
  })
  await check('invalid product ids make no requests', async () => {
    setup(); await auth.login(credentials); id.value = '0'; mount(); await flush()
    for (const invalid of ['0', 'bad', '-1', '../10', '2147483648']) { id.value = invalid; await flush(); assert.match(state.error.value, /Некорректный номер/) }
    assert.equal(reads.length, 0)
  })
  await check('route change discards old read and loads another product', async () => {
    await fresh(); let resolve; handler = () => new Promise((done) => { resolve = done })
    const old = state.load(); handler = defaultHandler; id.value = '20'; await flush()
    resolve(json(makeProduct(10))); await old; assert.equal(state.product.value.id, 20)
  })
  await check('logout and new session discard delayed write and notification', async () => {
    await fresh(); let resolve; state.openEditor(); handler = () => new Promise((done) => { resolve = done })
    const old = state.save({ size: '43.0', stock: 1 }); auth.logout(); handler = defaultHandler
    user = { ...profile, id: 9002 }; await auth.login(credentials); await flush()
    resolve(json({ id: 102, size: '43.0', stock: 1 }, 201)); assert.equal(await old, false)
    assert.equal(state.product.value.sizes.length, 1); assert.equal(notifications.current, null)
  })
  await check('leaving page aborts a pending write', async () => {
    await fresh(); let resolve, signal; state.openEditor()
    handler = (url, init) => { signal = init.signal; return new Promise((done) => { resolve = done }) }
    const pending = state.save({ size: '43.0', stock: 1 }); scope.stop(); assert.equal(signal.aborted, true)
    resolve(json({ id: 102, size: '43.0', stock: 1 }, 201)); assert.equal(await pending, false)
  })
  await check('login restores only inventory routes with valid product ids', () => {
    assert.deepEqual(loginReturnQuery({ name: 'admin-inventory', params: { productId: '10' } }), { next: 'admin-inventory', productId: '10' })
    assert.deepEqual(loginDestination({ next: 'admin-inventory', productId: '10' }), { name: 'admin-inventory', params: { productId: '10' } })
    for (const value of ['../10', '0', ['10']]) assert.deepEqual(loginDestination({ next: 'admin-inventory', productId: value }), { name: 'account' })
  })
  console.log(`Admin inventory checks: ${passed} passed. No real products or stock changes.`)
} finally {
  scope?.stop(); notifications?.$dispose(); auth?.$dispose(); globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else delete globalThis.sessionStorage
  await server.close()
}
