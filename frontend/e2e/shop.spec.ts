import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
}

async function registerAndLogin(page: Page) {
  const email = `e2e-${randomUUID()}@example.com`
  const password = randomUUID()
  await page.goto('/register')
  await page.getByLabel('Email', { exact: true }).fill(email)
  // Redact Playwright's fill call log if entering a generated password fails.
  const fillPassword = () => page.getByLabel('Пароль', { exact: true }).fill(password)
    .catch(() => { throw new Error('Unable to fill the test password field') })
  await fillPassword()
  await page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click()
  await page.getByRole('link', { name: 'Перейти ко входу', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await fillPassword()
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByText(email, { exact: true }).last()).toBeVisible()
}

test.beforeEach(async ({ request }) => {
  const response = await request.get(`/api/__e2e__/ready/${process.env.E2E_RUN_ID}`)
  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({ run_id: process.env.E2E_RUN_ID, isolated: true })
})

test('catalog filters, empty state, reset and public 404', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'North Runner', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const filters = page.getByRole('form', { name: 'Фильтры каталога' })
  await filters.getByRole('combobox', { name: 'Бренд', exact: true }).selectOption({ label: 'City' })
  await filters.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'City Walk', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'North Runner', exact: true })).toHaveCount(0)
  await filters.getByLabel('Название', { exact: true }).fill('nonexistent-e2e-product')
  await filters.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect(page.getByText('Товары не найдены. Измените фильтры или сбросьте их.')).toBeVisible()
  await filters.getByRole('button', { name: 'Сбросить', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'North Runner', exact: true })).toBeVisible()
  await page.goto('/unknown/nested')
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()
  await page.getByRole('link', { name: 'Перейти в каталог', exact: true }).click()
  await expect(page).toHaveURL('/')
})

test('registration, cart confirmations, checkout and purchase history', async ({ page }) => {
  await registerAndLogin(page)
  await page.goto('/')
  const addForm = page.getByRole('form', { name: 'Добавление North Runner в корзину', exact: true })
  const size = addForm.getByRole('radio', { name: '42', exact: true })
  await size.check()
  await addForm.getByRole('button', { name: 'В корзину', exact: true }).click()
  await expect(size).not.toBeChecked()
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'North Runner', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.getByRole('button', { name: 'Удалить North Runner, размер 42', exact: true }).click()
  const deletion = page.getByRole('dialog', { name: 'Удаление из корзины', exact: true })
  await expect(deletion).toBeVisible()
  await expect(deletion.getByRole('button', { name: 'Отмена', exact: true })).toBeFocused()
  await expect(page.locator('html')).toHaveCSS('overflow', 'hidden')
  await deletion.getByRole('button', { name: 'Отмена', exact: true }).click()
  await expect(deletion).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'North Runner', exact: true })).toBeVisible()

  const checkout = page.getByRole('button', { name: 'Оформить заказ', exact: true })
  await checkout.click()
  const confirmation = page.getByRole('dialog', { name: 'Оформление заказа', exact: true })
  await confirmation.getByRole('button', { name: 'Отмена', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Заказ №.*оформлен/ })).toHaveCount(0)
  await checkout.click()
  await confirmation.getByRole('button', { name: 'Оформить заказ', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Заказ №\d+ оформлен/ })).toBeVisible()
  await expect(page.getByText('Корзина пока пуста. Выберите свою пару в каталоге.', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Посмотреть заказ →', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'North Runner', exact: true })).toBeVisible()
  await expect(page.getByText(/^7\s990\s₽$/).first()).toBeVisible()
  await page.goto('/orders')
  await expect(page.getByRole('list', { name: 'История заказов' }).getByRole('listitem')).toHaveCount(1)
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
})

test('guest is redirected to login before opening protected pages', async ({ page }) => {
  await page.goto('/cart')
  await expect(page).toHaveURL(/\/login\?next=cart$/)
  await expect(page.getByRole('heading', { name: 'Вход', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
