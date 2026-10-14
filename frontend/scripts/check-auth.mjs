// Изолированные проверки с фиктивными ответами: БД и реальные аккаунты не меняются.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

const server = await createServer({
  server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
})
const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
const data = new Map()
const storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
  removeItem: (key) => data.delete(key),
}
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage })
let handler
globalThis.fetch = (url, init) => handler(String(url), init)
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const profile = { id: 9001, email: 'fixture@example.com', is_admin: false }
const credentials = { email: profile.email, password: 'fixture-only-not-a-real-password' }
const fixtureToken = 'fixture-token-not-a-jwt'
const key = 'north.access-token'
let passed = 0

try {
  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth/auth.store.ts')
  const authApi = await server.ssrLoadModule('/src/api/auth.api.ts')
  const { requestJson } = await server.ssrLoadModule('/src/api/http.client.ts')
  const { watchSessionNavigation } = await server.ssrLoadModule('/src/router/session-navigation.ts')
  let testPinia
  function fresh() {
    data.clear()
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage })
    testPinia = createPinia()
    setActivePinia(testPinia)
    return useAuthStore()
  }
  function success(url, init) {
    if (url === '/api/auth/login') return Promise.resolve(json({ access_token: fixtureToken, token_type: 'bearer' }))
    assert.equal(init.headers.get('Authorization'), `Bearer ${fixtureToken}`)
    return Promise.resolve(json(profile))
  }
  async function check(name, run) { await run(); passed++; console.log(`OK: ${name}`) }

  await check('guest initialization performs no request', async () => {
    const auth = fresh()
    handler = () => { throw new Error('Unexpected request') }
    await auth.restoreSession()
    assert.equal(auth.initializing, false)
    assert.equal(auth.isAuthenticated, false)
  })

  await check('registration sends credentials but does not create a session', async () => {
    fresh()
    handler = async (url, init) => {
      assert.equal(url, '/api/auth/register')
      assert.equal(init.method, 'POST')
      assert.deepEqual(JSON.parse(init.body), credentials)
      assert.equal(init.headers.has('Authorization'), false)
      return json(profile, 201)
    }
    assert.deepEqual(await authApi.register(credentials), profile)
    assert.equal(data.size, 0)
  })

  await check('invalid credentials leave the user signed out', async () => {
    const auth = fresh()
    handler = async () => json({ detail: 'Invalid credentials' }, 401)
    await assert.rejects(auth.login(credentials), (e) => e.status === 401)
    assert.equal(auth.isAuthenticated, false)
    assert.equal(auth.busy, false)
    assert.equal(data.size, 0)
  })

  await check('login verifies profile before persisting token; password is not in state', async () => {
    const auth = fresh()
    handler = success
    assert.equal(await auth.login(credentials), true)
    assert.deepEqual(auth.user, profile)
    assert.equal(auth.isAuthenticated, true)
    assert.equal(data.get(key), fixtureToken)
    assert.equal(JSON.stringify(auth.$state).includes(credentials.password), false)
    auth.logout()
    assert.equal(data.size, 0)
    assert.equal(auth.user, null)
  })

  await check('failed profile verification does not persist the login token', async () => {
    const auth = fresh()
    handler = async (url) => url.endsWith('/login')
      ? json({ access_token: fixtureToken, token_type: 'bearer' }) : json({}, 503)
    await assert.rejects(auth.login(credentials))
    assert.equal(auth.isAuthenticated, false)
    assert.equal(data.size, 0)
  })

  await check('restoration validates saved token and deduplicates parallel calls', async () => {
    const auth = fresh()
    data.set(key, fixtureToken)
    let calls = 0
    handler = async (...args) => { calls++; return success(...args) }
    await Promise.all([auth.restoreSession(), auth.restoreSession()])
    assert.equal(calls, 1)
    assert.equal(auth.isAuthenticated, true)
    assert.equal(auth.initializing, false)
  })

  await check('401 on restoration clears session', async () => {
    const auth = fresh()
    data.set(key, fixtureToken)
    handler = async () => json({}, 401)
    await auth.restoreSession()
    assert.equal(auth.isAuthenticated, false)
    assert.equal(data.size, 0)
    assert.ok(auth.notice)
  })

  await check('network failure preserves token for an explicit restoration retry', async () => {
    const auth = fresh()
    data.set(key, fixtureToken)
    handler = async () => { throw new TypeError('fixture network failure') }
    await auth.restoreSession()
    assert.equal(data.get(key), fixtureToken)
    assert.equal(auth.isAuthenticated, false)
    assert.ok(auth.sessionError)
    handler = success
    await auth.restoreSession()
    assert.equal(auth.isAuthenticated, true)
    assert.equal(auth.sessionError, '')
  })

  await check('late restoration cannot undo logout', async () => {
    const auth = fresh()
    data.set(key, fixtureToken)
    let resolve
    handler = () => new Promise((done) => { resolve = done })
    const pending = auth.restoreSession()
    auth.logout()
    resolve(json(profile))
    await pending
    assert.equal(auth.user, null)
    assert.equal(data.size, 0)
  })

  await check('late login cannot undo logout', async () => {
    const auth = fresh()
    let resolve
    handler = (url, init) => url.endsWith('/login')
      ? new Promise((done) => { resolve = done }) : success(url, init)
    const pending = auth.login(credentials)
    auth.logout()
    resolve(json({ access_token: fixtureToken, token_type: 'bearer' }))
    assert.equal(await pending, false)
    assert.equal(auth.user, null)
    assert.equal(data.size, 0)
  })

  await check('403 keeps session; current-session 401 clears it', async () => {
    const auth = fresh()
    handler = success
    await auth.login(credentials)
    handler = async () => json({}, 403)
    await assert.rejects(auth.authorizedRequest('/auth/me'), (e) => e.status === 403)
    assert.equal(auth.isAuthenticated, true)
    handler = async () => json({}, 401)
    await assert.rejects(auth.refreshProfile(), (e) => e.status === 401)
    assert.equal(auth.isAuthenticated, false)
    assert.equal(data.size, 0)
  })

  await check('401 from old session cannot clear a newer login', async () => {
    const auth = fresh()
    handler = success
    await auth.login(credentials)
    let resolve
    handler = () => new Promise((done) => { resolve = done })
    const pending = auth.authorizedRequest('/auth/me')
    const checked = assert.rejects(pending, (e) => e.status === 401)
    auth.logout()
    handler = success
    await auth.login(credentials)
    resolve(json({}, 401))
    await checked
    assert.equal(auth.isAuthenticated, true)
  })

  await check('blocked browser storage still permits an in-memory session', async () => {
    const auth = fresh()
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true, get() { throw new Error('fixture blocked storage') },
    })
    await auth.restoreSession()
    handler = success
    assert.equal(await auth.login(credentials), true)
    auth.logout()
    assert.equal(auth.isAuthenticated, false)
  })

  for (const protectedRoute of [true, false]) {
    await check(`logout ${protectedRoute ? 'leaves protected page' : 'keeps public page'}`, async () => {
      const auth = fresh()
      handler = success
      await auth.login(credentials)
      const component = { render: () => null }
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/', name: 'catalog', component },
          { path: '/login', name: 'login', component },
          { path: '/account', name: 'account', component, meta: { requiresAuth: true } },
        ],
      })
      await router.push(protectedRoute ? '/account' : '/')
      const stop = watchSessionNavigation(router, testPinia)
      try {
        auth.logout()
        await new Promise((resolve) => setImmediate(resolve))
        assert.equal(router.currentRoute.value.name, protectedRoute ? 'login' : 'catalog')
      } finally { stop() }
    })
  }

  await check('request helper refuses an external destination', async () => {
    handler = () => { throw new Error('External request must not be sent') }
    await assert.rejects(requestJson('https://example.com/private', { token: fixtureToken }))
    await assert.rejects(requestJson('//example.com/private', { token: fixtureToken }))
  })

  console.log(`Auth checks: ${passed} passed. No real accounts or database changes.`)
} finally {
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else delete globalThis.sessionStorage
  await server.close()
}
