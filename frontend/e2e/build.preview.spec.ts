import { expect, test } from '@playwright/test'

test('built assets, history fallback and API errors are served correctly', async ({ page, request }) => {
  const ready = await request.get(`/api/__e2e__/ready/${process.env.E2E_RUN_ID}`)
  expect(await ready.json()).toEqual({ run_id: process.env.E2E_RUN_ID, isolated: true })

  const root = await request.get('/')
  const html = await root.text()
  expect(root.status()).toBe(200)
  expect(html).not.toContain('/@vite/client')
  expect(html).not.toContain('/src/main.ts')
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g)].map(match => match[1]!)
  expect(assets.length).toBeGreaterThanOrEqual(2)
  for (const path of assets) {
    const asset = await request.get(path)
    expect(asset.status(), path).toBe(200)
    expect(asset.headers()['content-type']).toMatch(path.endsWith('.js') ? /javascript/ : /css/)
  }

  // A deep URL receives the SPA shell, then Vue Router chooses the page.
  const deep = await request.get('/unknown/nested')
  expect(deep.status()).toBe(200)
  expect(deep.headers()['content-type']).toContain('text/html')
  await page.goto('/unknown/nested')
  await expect(page.getByRole('heading', { name: 'Страница не найдена', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Страница не найдена', exact: true })).toBeVisible()
  await page.goto('/login')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Вход', exact: true })).toBeVisible()

  const missingApi = await request.get('/api/unknown/nested')
  expect(missingApi.status()).toBe(404)
  expect(missingApi.headers()['content-type']).toContain('application/json')
  expect(await missingApi.json()).toEqual({ detail: 'Not Found' })
})
