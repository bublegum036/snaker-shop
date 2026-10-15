// Проверяем длительность без реального ожидания и без запросов к рабочей БД.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
const originalSetTimeout = globalThis.setTimeout
const originalClearTimeout = globalThis.clearTimeout
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} } })
let now = 0, sequence = 0, notifications, auth, passed = 0
const timers = new Map()

try {
  const { useNotificationsStore } = await server.ssrLoadModule('/src/stores/notifications/notifications.store.ts')
  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth/auth.store.ts')
  globalThis.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id }
  globalThis.clearTimeout = (id) => timers.delete(id)
  function advance(milliseconds) {
    now += milliseconds
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback() }
  }
  function fresh() {
    notifications?.$dispose(); auth?.$dispose(); timers.clear(); now = 0
    setActivePinia(createPinia()); auth = useAuthStore(); notifications = useNotificationsStore()
  }
  async function check(name, run) { fresh(); await run(); passed++; console.log(`OK: ${name}`) }

  await check('success stays for 2999ms and expires at 3000ms', () => {
    notifications.success('Saved'); advance(2999); assert.equal(notifications.current.message, 'Saved')
    advance(1); assert.equal(notifications.current, null); assert.equal(timers.size, 0)
  })
  await check('new success gets its own full three seconds', () => {
    notifications.success('First'); advance(2000); notifications.success('Second'); advance(1000)
    assert.equal(notifications.current.message, 'Second'); advance(1999); assert.ok(notifications.current)
    advance(1); assert.equal(notifications.current, null)
  })
  await check('identical messages also restart the timer', () => {
    notifications.success('Saved'); const firstId = notifications.current.id
    advance(2500); notifications.success('Saved'); assert.notEqual(notifications.current.id, firstId)
    advance(500); assert.ok(notifications.current); advance(2500); assert.equal(notifications.current, null)
  })
  await check('stale timeout and close cannot hide a newer notification', () => {
    notifications.success('First'); const firstId = notifications.current.id
    const oldTimeout = [...timers.values()][0].callback
    notifications.success('Second'); oldTimeout(); notifications.dismiss(firstId)
    assert.equal(notifications.current.message, 'Second')
  })
  await check('manual close cancels the timer', () => {
    notifications.success('Saved'); notifications.dismiss(); assert.equal(notifications.current, null); assert.equal(timers.size, 0)
  })
  await check('logout clears success immediately', () => {
    auth.accessToken = 'fixture-token'; auth.user = { id: 9001, email: 'fixture@example.com', is_admin: true }
    notifications.success('Saved'); auth.logout(); assert.equal(notifications.current, null); assert.equal(timers.size, 0)
  })
  await check('role change clears old administrator message', () => {
    auth.accessToken = 'fixture-token'; auth.user = { id: 9001, email: 'fixture@example.com', is_admin: true }
    notifications.success('Saved'); auth.user = { ...auth.user, is_admin: false }; assert.equal(notifications.current, null)
  })
  await check('store disposal removes its timer', () => {
    notifications.success('Saved'); notifications.$dispose(); assert.equal(timers.size, 0)
  })
  console.log(`Notification checks: ${passed} passed. No real accounts or database changes.`)
} finally {
  notifications?.$dispose(); auth?.$dispose()
  globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else delete globalThis.sessionStorage
  await server.close()
}
