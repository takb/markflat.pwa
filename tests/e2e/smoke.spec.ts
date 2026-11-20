import { readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const sheet = (page: Page) => page.locator('[data-current] .mb')
const chord = (page: Page) => sheet(page).locator('.mb-chord').first()

test('list → song → transpose → back (read key)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await open(page, 'e2e-read')
  await expect(page.getByRole('button', { name: 'New song' })).toHaveCount(0)

  await page.getByRole('searchbox', { name: 'Search' }).fill('beatles')
  await expect(page.locator('[data-song]')).toHaveCount(1)
  await page.locator('[data-song]', { hasText: 'Yesterday' }).click()
  await expect(sheet(page).locator('h1')).toContainText('The Beatles')
  await expect(chord(page)).toHaveText('C')
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Transpose up' }).click()
  // spelled in the key it is played in: C major up one is D♭ major, shown in the toolbar
  await expect(chord(page)).toHaveText('D♭')
  await expect(page.getByTestId('transpose-value')).toHaveText('+1 · D♭')

  // The browser's back (the phone's back gesture) goes back to the list, search kept.
  await page.goBack()
  await expect(page.locator('[data-song]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('menuitem', { name: 'Keys' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Deleted songs' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // the arrow in front of the title goes back to the list too
  await page.locator('[data-song]', { hasText: 'Yesterday' }).click()
  await page.getByRole('button', { name: 'Back to the list' }).click()
  await expect(page.locator('[data-song]')).toHaveCount(1)
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
  // the first save adds the key, worked out from the chords (a G C D: G), in front of the heading
  expect(readFileSync(DATA + '/zeta_song.mb', 'utf8')).toMatch(/^---\nkey: G\n---\n# Zeta Song - Tester\n/)
  await expect(page.locator('.cm-content')).toContainText('key: G')
  await expect(page.getByRole('heading', { name: 'Zeta Song ●' })).toHaveCount(0)
  // The saved song survives a reload (which stays in the editor) and renders the new chord.
  await page.reload()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(sheet(page).locator('.mb-chord').last()).toHaveText('D')
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

test('on a phone: pinch sets the font size, two fingers transpose, an edge tap turns the page, the toolbar hides', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL })
  const page = await context.newPage()
  await open(page, 'e2e-read')
  await page.locator('[data-song]', { hasText: 'Yesterday' }).click()
  const current = page.locator('[data-current]')
  await expect(chord(page)).toHaveText('C')

  // Fingers on the song, as touch events (what a phone sends).
  const touch = (type: string, points: [number, number][], changed = points) => current.evaluate((el, a) => {
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
  await expect(sheet(page)).toHaveCSS('font-size', '32px')

  // Two fingers up by 110 px, their distance unchanged: two semitones up.
  await touch('touchstart', [[150, 500], [250, 500]])
  await touch('touchmove', [[150, 460], [250, 460]])
  await touch('touchmove', [[150, 390], [250, 390]])
  await touch('touchend', [], [[150, 390], [250, 390]])
  await expect(chord(page)).toHaveText('D')
  await expect(page.getByLabel('Transposed by 2, to D, tap to reset')).toHaveText('+2 · D')

  // Scrolling down hides the toolbar, scrolling up brings it back.
  const toolbar = page.getByRole('toolbar', { name: 'Song' })
  await expect(toolbar).toHaveAttribute('data-visible', 'true')
  await current.evaluate(el => el.scrollBy(0, 300))
  await expect(toolbar).toHaveAttribute('data-visible', 'false')
  await current.evaluate(el => el.scrollBy(0, -100))
  await expect(toolbar).toHaveAttribute('data-visible', 'true')

  // A tap on the right edge: the next song of the list as shown, with an arrow; back returns
  // to the list, not to the previous song.
  const width = page.viewportSize()!.width
  await page.waitForTimeout(450) // a tap right after a gesture is ignored on purpose
  const arrowShown = page.waitForSelector('[data-testid="page-arrow"][data-side="next"]', { state: 'attached', timeout: 3000 })
  await page.mouse.click(width - 10, 300)
  await arrowShown
  await expect(page.locator('[data-current]')).toHaveAttribute('data-slug', 'zeta_song')
  await expect(page).toHaveURL(/#\/song\/zeta_song$/)
  await page.goBack()
  await expect(page.locator('[data-song]')).toHaveCount(2)
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

test('set lists: make one, add, reorder, play, remember the key, replace a missing song', async ({ page }) => {
  await open(page, 'e2e-writer')
  const chooser = page.getByTestId('list-chooser')

  // a new list from the chooser
  await chooser.click()
  await page.getByRole('menuitem', { name: 'Add new list…' }).click()
  await page.locator('#nameInput').fill('Gig 12.12.')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(chooser).toContainText('Gig 12.12.')
  await expect(page.getByText('This list is empty.')).toBeVisible()

  // songs from the dialog (it stays open) and from a row of All songs
  await page.getByRole('button', { name: 'Add song' }).click()
  await page.locator('[data-pick="zeta_song"]').click()
  await page.locator('[data-pick="yesterday"]').click()
  await expect(page.getByRole('dialog')).toContainText('2 added')
  await page.getByRole('button', { name: 'Done' }).click()
  await chooser.click()
  await page.getByRole('menuitem', { name: 'All songs' }).click()
  // no row carries a menu of its own until its icon is tapped (one per row made the list slow)
  await expect(page.locator('li [aria-haspopup="menu"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add Yesterday to a set list' }).click()
  await page.getByRole('menuitem', { name: /Gig 12\.12\./ }).click()
  await chooser.click()
  await page.getByRole('menuitem', { name: /Gig 12\.12\./ }).click()
  const rows = page.locator('[data-current] [data-entry]')
  await expect(rows).toHaveCount(3)
  expect(await rows.evaluateAll(r => r.map(e => e.getAttribute('data-slug')))).toEqual(['zeta_song', 'yesterday', 'yesterday'])

  // drag and drop: the last Yesterday to the top
  await rows.nth(2).locator('.handle').dragTo(rows.nth(0).locator('.handle'))
  await expect.poll(() => rows.evaluateAll(r => r.map(e => e.getAttribute('data-slug')))).toEqual(['yesterday', 'zeta_song', 'yesterday'])
  await rows.nth(2).getByRole('button', { name: 'Remove from the list' }).click()
  await expect(rows).toHaveCount(2)

  // play from the second title; the toolbar shows the list and the position
  await rows.nth(1).getByRole('button', { name: 'Zeta Song' }).click()
  await expect(page.locator('[data-current]')).toHaveAttribute('data-slug', 'zeta_song')
  await expect(page.getByTestId('toolbar-list')).toContainText('Gig 12.12.')
  await expect(page.getByTestId('toolbar-list')).toContainText('2/2')
  await expect(page).toHaveURL(/#\/set\/[^/]+\/2$/)

  // the arrow keys turn pages; a key set while playing is remembered for the entry
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('[data-current]')).toHaveAttribute('data-slug', 'yesterday')
  await page.getByRole('button', { name: 'Transpose up' }).click()
  await expect(chord(page)).toHaveText('D♭')
  await page.reload()
  await expect(page.locator('[data-current]')).toHaveAttribute('data-slug', 'yesterday')
  await expect(chord(page)).toHaveText('D♭')

  // back: the list page, with the key shown; then All songs
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('[data-current][data-page="0"]')).toBeVisible()
  await expect(rows.nth(0)).toContainText('+1')
  await page.goBack()
  await expect(page.locator('[data-song]')).toHaveCount(2)

  // a song deleted on the server: missing in the list, replaced from the dialog
  const zeta = readFileSync(DATA + '/zeta_song.mb', 'utf8')
  rmSync(DATA + '/zeta_song.mb')
  await menu(page, 'Download songbook')
  await expect(page.locator('[data-song]')).toHaveCount(1)
  writeFileSync(DATA + '/zeta_song.mb', zeta) // back for the tests after this one
  await chooser.click()
  await page.getByRole('menuitem', { name: /Gig 12\.12\./ }).click()
  await expect(rows.nth(1)).toContainText('missing: Zeta Song')
  await rows.nth(1).getByRole('button', { name: 'Replace' }).click()
  await page.locator('[data-pick="yesterday"]').click()
  await expect(rows.nth(1)).not.toHaveAttribute('data-missing')

  // rename, duplicate, delete
  await page.getByRole('button', { name: 'List actions' }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.locator('#nameInput').fill('Gig 13.12.')
  await page.getByRole('button', { name: 'Rename' }).click()
  await expect(chooser).toContainText('Gig 13.12.')
  await page.getByRole('button', { name: 'List actions' }).click()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await expect(chooser).toContainText('Gig 13.12. (copy)')
  await page.getByRole('button', { name: 'List actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(chooser).toContainText('All songs')
  await chooser.click()
  await expect(page.getByRole('menuitem', { name: /Gig 13\.12\./ })).toHaveCount(1)
})

test('a new song deleted before it was saved: no copy on the server is claimed', async ({ page }) => {
  await open(page, 'e2e-writer')
  await page.getByRole('button', { name: 'New song' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog')).not.toContainText('server')
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('[data-state=open]', { hasText: 'Deleted' })).toHaveText('DeletedNew song was deleted.')
  await expect(page.locator('[data-song]')).toHaveCount(2)
})

test('a song changed elsewhere is noticed and synced', async ({ page }) => {
  await open(page, 'e2e-read')
  const notice = page.getByTestId('remote-notice')
  const check = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await check()
  await expect(notice).toHaveCount(0)

  // another device saves Yesterday
  const before = readFileSync(DATA + '/yesterday.mb', 'utf8')
  writeFileSync(DATA + '/yesterday.mb', before.replace('# Yesterday - The Beatles', '# Yesterday - The Beatles\n1. {D}Changed elsewhere'))
  try {
    await check()
    await expect(notice).toContainText('Yesterday changed')

    // while a song plays: no notice over it, a dot on ⋯ and Sync in its menu
    await page.locator('[data-song]', { hasText: 'Yesterday' }).click()
    await expect(notice).toHaveCount(0)
    await expect(page.getByTestId('remote-dot')).toBeVisible()
    await page.getByRole('button', { name: /More/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Sync (1 changed)' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.goBack()

    await notice.getByRole('button', { name: 'Sync' }).click()
    await expect(notice).toHaveCount(0)
    await page.locator('[data-song]', { hasText: 'Yesterday' }).click()
    await expect(sheet(page)).toContainText('Changed elsewhere')
    await expect(page.getByTestId('remote-dot')).toHaveCount(0)
  } finally {
    writeFileSync(DATA + '/yesterday.mb', before)
  }
})

test('a chord chart: typed, aligned, shown as bars in jazz symbols', async ({ page }) => {
  await open(page, 'e2e-writer')
  await page.getByRole('button', { name: 'New song' }).click()
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('# Chart Test - Tester (Bossa Nova)\n~A {4/4}\n{|| a6 | % | Ab07 | % |\n{| g7 | C7 | F07 F7+ | F7+ ||\n')
  await page.getByRole('button', { name: 'Align bars' }).click()
  await expect(page.locator('.cm-content')).toContainText('{|| a6 | %  | Ab07    | %   |')
  await page.keyboard.press('Control+z')
  await expect(page.locator('.cm-content')).toContainText('{|| a6 | % | Ab07 | % |')
  await page.keyboard.press('Control+Shift+a')
  await expect(page.locator('.cm-content')).toContainText('{|| a6 | %  | Ab07    | %   |')

  // the preview (side by side on a wide screen): one grid of 4 bars, the remark under the artist
  const preview = page.locator('.mb').last()
  await expect(preview.locator('.mb-row')).toHaveCount(2)
  await expect(preview.locator('.mb-row').first().locator('.mb-bar')).toHaveCount(4)
  await expect(preview.locator('.mb-remark')).toHaveText('(Bossa Nova)')
  await expect(preview.locator('.mb-section')).toHaveText('A')
  await expect(preview.locator('.mb-cc').first()).toHaveText('a6')
})

test('on a phone: a pinch on the list sets the rows\' font size, kept, apart from the songs\'', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL })
  const page = await context.newPage()
  await open(page, 'e2e-read')
  const list = page.getByTestId('song-list')
  await expect(list).toHaveCSS('font-size', '16px')

  const touch = (type: string, points: [number, number][], changed = points) => list.evaluate((el, a) => {
    const t = (p: number[], i: number) => new Touch({ identifier: i, target: el, clientX: p[0], clientY: p[1] })
    el.dispatchEvent(new TouchEvent(a.type, {
      touches: a.points.map(t), targetTouches: a.points.map(t), changedTouches: a.changed.map(t), bubbles: true, cancelable: true,
    }))
  }, { type, points, changed })
  // fingers apart to one and a half times their distance: rows one and a half times as large
  await touch('touchstart', [[150, 200], [250, 200]])
  await touch('touchmove', [[125, 200], [275, 200]])
  await page.waitForTimeout(50)
  await touch('touchend', [], [[125, 200], [275, 200]])
  await expect(list).toHaveCSS('font-size', '24px')
  await expect(list.locator('[data-song] .text-muted').first()).toHaveCSS('font-size', '21px') // the artist, 0.875 em

  await page.reload()
  await expect(page.getByTestId('song-list')).toHaveCSS('font-size', '24px')
  await page.locator('[data-song]', { hasText: 'Yesterday' }).click()
  await expect(sheet(page)).toHaveCSS('font-size', '16px') // the song keeps its own size
  await context.close()
})
