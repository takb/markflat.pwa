import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const DATA = 'node_modules/.tmp/e2e-site/data'

// A fresh browser has no songbook: set the test keys and download it, as a user would after
// entering the keys in the settings.
const open = async (page: Page) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('apiKeyRead')) {
      localStorage.setItem('apiKeyRead', 'e2e-read')
      localStorage.setItem('apiKeyWrite', 'e2e-write')
    }
  })
  await page.goto('/')
  await page.locator('.pi-ellipsis-v').click()
  await page.getByRole('menuitem', { name: 'Download songbook' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  // The "ready to work offline" notice sits over the song menu.
  const notice = page.locator('.pwa-toast button')
  await notice.last().click({ timeout: 5000 }).catch(() => {})
}

test('list → show → transpose', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await open(page)
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
  expect(errors).toEqual([])
})

test('edit → save → reload', async ({ page }) => {
  await open(page)
  await page.locator('.pi-ellipsis-v').click()
  await page.getByRole('menuitem', { name: 'Edit mode' }).click()
  await page.locator('tr', { hasText: 'Zeta Song' }).locator('.pi-pencil').click()
  const editor = page.locator('[contenteditable]').first()
  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('\n2. a new {D}verse')
  await page.keyboard.press('Control+s')
  await expect.poll(() => readFileSync(DATA + '/zeta_song.mb', 'utf8')).toContain('2. a new {D}verse')
  // The saved song survives a reload (localStorage) and renders the new chord.
  await page.reload()
  await page.getByText('Zeta Song').click()
  await expect(page.locator('.mb .mb-chord').last()).toHaveText('D')
})
