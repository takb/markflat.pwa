import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const DATA = 'node_modules/.tmp/e2e-site/data'

// A fresh browser: set a key and download the songbook, as a user would.
const open = async (page: Page, key: string) => {
  await page.addInitScript(k => {
    if (!localStorage.getItem('markflat.key')) localStorage.setItem('markflat.key', k)
  }, key)
  await page.goto('/')
  // The "ready to work offline" notice sits over the song menu.
  await page.locator('.pwa-toast button').last().click({ timeout: 5000 }).catch(() => {})
  await menu(page, 'Download songbook')
  await expect(page.locator('tbody tr')).toHaveCount(2)
}
const menu = async (page: Page, item: string) => {
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}
const editSong = async (page: Page, title: string, append: string) => {
  await menu(page, 'Edit mode')
  await page.locator('tr', { hasText: title }).getByRole('button', { name: 'Edit' }).click()
  await page.locator('[contenteditable]').first().click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(append)
}

test('list → show → transpose (read key)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await open(page, 'e2e-read')
  await page.getByText('Yesterday').click()
  const sheet = page.locator('.mb')
  await expect(sheet.locator('h1')).toContainText('The Beatles')
  await expect(sheet.locator('.mb-chord').first()).toHaveText('C')
  await page.locator('.p-speeddial-button').click()
  await page.getByRole('menuitem', { name: 'Transpose up' }).click()
  await expect(sheet.locator('.mb-chord').first()).toHaveText('C♯')
  await page.locator('.p-speeddial-button').click() // the menu closes after each action
  await page.getByRole('menuitem', { name: 'Return to list' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('menuitem', { name: 'Keys' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('edit → save → reload (write key)', async ({ page }) => {
  await open(page, 'e2e-writer')
  await editSong(page, 'Zeta Song', '\n2. a new {D}verse')
  await expect(page.getByText('Zeta Song *')).toBeVisible()
  await page.keyboard.press('Control+s')
  await expect.poll(() => readFileSync(DATA + '/zeta_song.mb', 'utf8')).toContain('2. a new {D}verse')
  await expect(page.getByText('Zeta Song *')).toHaveCount(0)
  // The saved song survives a reload and renders the new chord.
  await page.reload()
  await page.getByText('Zeta Song').click()
  await expect(page.locator('.mb .mb-chord').last()).toHaveText('D')
})

test('a save over a change made elsewhere asks which version stays', async ({ page }) => {
  await open(page, 'e2e-writer')
  writeFileSync(DATA + '/yesterday.mb', readFileSync(DATA + '/yesterday.mb', 'utf8') + '\n5. from another device\n')
  await editSong(page, 'Yesterday', '\n6. from this device')
  await page.keyboard.press('Control+s')
  const dialog = page.getByRole('dialog', { name: 'This song changed on the server too' })
  await expect(dialog).toContainText('from another device')
  await dialog.getByRole('button', { name: 'Keep this device\'s' }).click()
  await expect(dialog).toBeHidden()
  const saved = readFileSync(DATA + '/yesterday.mb', 'utf8')
  expect(saved).toContain('6. from this device')
  expect(saved).not.toContain('from another device')
})

test('the admin creates and revokes a write key', async ({ page }) => {
  await open(page, 'e2e-admin')
  await menu(page, 'Keys')
  await page.getByRole('button', { name: 'New write key' }).click()
  await page.locator('#writerName').fill('lou')
  await page.getByRole('button', { name: 'Create' }).click()
  const key = await page.getByTestId('new-key').inputValue()
  expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/)
  await page.getByRole('button', { name: 'Done' }).click()
  const row = page.locator('tr', { hasText: 'lou' })
  await expect(row).toContainText('by admin')

  const lou = await page.request.get('/api/me', { headers: { 'X-Api-Key': key } })
  expect(await lou.json()).toEqual({ writer: 'lou', canWrite: true, isAdmin: false })

  await row.getByRole('button', { name: 'Revoke' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click()
  await expect(page.locator('tr', { hasText: 'lou' })).toHaveCount(0)
  expect((await page.request.get('/api/me', { headers: { 'X-Api-Key': key } })).status()).toBe(401)
})
