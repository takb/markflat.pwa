import { readFileSync, writeFileSync } from 'node:fs'
import { devices, expect, test, type Page } from '@playwright/test'

const DATA = 'node_modules/.tmp/e2e-site/data'

// A fresh browser: set a key and download the songbook, as a user would.
const open = async (page: Page, key: string) => {
  await page.addInitScript(k => {
    if (!localStorage.getItem('markflat.key')) localStorage.setItem('markflat.key', k)
  }, key)
  await page.goto('/')
  // The "works offline" notice may sit over the header.
  await page.locator('.pwa-toast').getByRole('button', { name: 'Close' }).click({ timeout: 3000 }).catch(() => {})
  await menu(page, 'Download songbook')
  await expect(page.locator('[data-song]')).toHaveCount(2)
}
const menu = async (page: Page, item: string) => {
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}
const editSong = async (page: Page, title: string, append: string) => {
  await page.locator('[data-song]', { hasText: title }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(append)
}
const chord = (page: Page) => page.locator('.mb .mb-chord').first()

test('list → song → transpose → back (read key)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await open(page, 'e2e-read')
  await expect(page.getByRole('button', { name: 'New song' })).toHaveCount(0)

  await page.getByRole('searchbox', { name: 'Search' }).fill('beatles')
  await expect(page.locator('[data-song]')).toHaveCount(1)
  await page.locator('[data-song]', { hasText: 'Yesterday' }).click()
  await expect(page.locator('.mb h1')).toContainText('The Beatles')
  await expect(chord(page)).toHaveText('C')
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Transpose up' }).click()
  await expect(chord(page)).toHaveText('C♯')
  await expect(page.getByLabel('Transposed by 1')).toHaveText('+1')

  // The browser's back (the phone's back gesture) goes back to the list, search kept.
  await page.goBack()
  await expect(page.locator('[data-song]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('menuitem', { name: 'Keys' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Deleted songs' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('edit → save → reload (write key)', async ({ page }) => {
  await open(page, 'e2e-writer')
  await editSong(page, 'Zeta Song', '\n2. a new {D}verse')
  await expect(page.getByRole('heading', { name: 'Zeta Song ●' })).toBeVisible()
  // markflat highlighting: the new chord is marked as one
  await expect(page.locator('.cm-content').getByText('{D}')).toHaveCSS('font-weight', '600')
  await page.keyboard.press('Control+s')
  await expect.poll(() => readFileSync(DATA + '/zeta_song.mb', 'utf8')).toContain('2. a new {D}verse')
  await expect(page.getByRole('heading', { name: 'Zeta Song ●' })).toHaveCount(0)
  // The saved song survives a reload (which stays in the editor) and renders the new chord.
  await page.reload()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('.mb .mb-chord').last()).toHaveText('D')
})

test('an old version comes back from the history', async ({ page }) => {
  await open(page, 'e2e-writer')
  const before = readFileSync(DATA + '/zeta_song.mb', 'utf8')
  await editSong(page, 'Zeta Song', '\n9. to be undone')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => readFileSync(DATA + '/zeta_song.mb', 'utf8')).toContain('to be undone')

  await page.getByRole('button', { name: 'History' }).click()
  await page.getByRole('button', { name: /The version before writer saved/ }).first().click()
  await page.getByRole('button', { name: 'Restore this version' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click()
  await expect.poll(() => readFileSync(DATA + '/zeta_song.mb', 'utf8')).toBe(before)
  await expect(page.locator('.cm-content')).not.toContainText('to be undone')
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

test('the admin makes and revokes named read and write keys', async ({ page }) => {
  await open(page, 'e2e-admin')
  await menu(page, 'Keys')
  const make = async (name: string, role: 'Read' | 'Read and write') => {
    await page.getByRole('button', { name: 'New key' }).click()
    await page.locator('#keyName').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: role, exact: true }).click()
    await page.getByRole('button', { name: 'Create' }).click()
    const key = await page.getByTestId('new-key').inputValue()
    expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/)
    await page.getByRole('button', { name: 'Done' }).click()
    return key
  }
  const me = async (key: string) => {
    const r = await page.request.get('/api/me', { headers: { 'X-Api-Key': key } })
    return r.status() === 200 ? await r.json() : r.status()
  }
  const revoke = async (name: string) => {
    await page.locator(`[data-key-name="${name}"]`).getByRole('button', { name: 'Revoke' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click()
    await expect(page.locator(`[data-key-name="${name}"]`)).toHaveCount(0)
  }

  const lou = await make('lou', 'Read and write')
  const band = await make('band', 'Read')
  await expect(page.locator('[data-key-name="lou"]')).toContainText('Writes')
  await expect(page.locator('[data-key-name="band"]')).toContainText('by admin')
  await expect(page.locator('[data-key-name="admin"]').getByRole('button', { name: 'Revoke' })).toHaveCount(0)
  expect(await me(lou)).toEqual({ name: 'lou', writer: 'lou', canWrite: true, isAdmin: false })
  expect(await me(band)).toEqual({ name: 'band', writer: null, canWrite: false, isAdmin: false })

  await revoke('lou')
  await revoke('band')
  expect([await me(lou), await me(band)]).toEqual([401, 401])
})

test('on a phone: pinch sets the font size, a swipe transposes, the toolbar hides', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL })
  const page = await context.newPage()
  await open(page, 'e2e-read')
  await page.locator('[data-song]', { hasText: 'Yesterday' }).click()
  const area = page.locator('.song-area')
  await expect(chord(page)).toHaveText('C')

  // Fingers on the song, as touch events (what a phone sends).
  const touch = (type: string, points: [number, number][], changed = points) => area.evaluate((el, a) => {
    const t = (p: number[], i: number) => new Touch({ identifier: i, target: el, clientX: p[0], clientY: p[1] })
    el.dispatchEvent(new TouchEvent(a.type, {
      touches: a.points.map(t), targetTouches: a.points.map(t), changedTouches: a.changed.map(t), bubbles: true, cancelable: true,
    }))
  }, { type, points, changed })

  // Two fingers apart to twice their distance: twice the font size, laid out again.
  await touch('touchstart', [[150, 300], [250, 300]])
  await touch('touchmove', [[100, 300], [300, 300]])
  await page.waitForTimeout(50)
  await touch('touchend', [], [[100, 300], [300, 300]])
  await expect(page.locator('.mb')).toHaveCSS('font-size', '32px')

  // A quick sideways swipe to the left: one semitone down.
  await touch('touchstart', [[300, 400]])
  await touch('touchend', [], [[150, 410]])
  await expect(chord(page)).toHaveText('B')

  // Scrolling down hides the toolbar, scrolling up brings it back.
  const toolbar = page.getByRole('toolbar', { name: 'Song' })
  await expect(toolbar).toHaveAttribute('data-visible', 'true')
  const scroller = page.locator('.song-area').locator('..')
  await scroller.evaluate(el => el.scrollBy(0, 300))
  await expect(toolbar).toHaveAttribute('data-visible', 'false')
  await scroller.evaluate(el => el.scrollBy(0, -100))
  await expect(toolbar).toHaveAttribute('data-visible', 'true')
  await context.close()
})

test('without a key the empty list says what to do; the list does not zoom', async ({ page }) => {
  await page.goto('/')
  await page.locator('.pwa-toast').getByRole('button', { name: 'Close' }).click({ timeout: 3000 }).catch(() => {})
  const empty = page.locator('[data-empty="no-key"]')
  await expect(empty).toContainText('No key entered yet')
  await expect(page.locator('.list')).toHaveCSS('touch-action', 'pan-x pan-y')
  await empty.getByRole('button', { name: 'Enter a key' }).click()
  await page.locator('#apiKey').fill('e2e-read')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-empty="no-songs"]')).toBeVisible()
  await page.getByRole('button', { name: 'Download songbook' }).click()
  await expect(page.locator('[data-song]')).toHaveCount(2)
})
