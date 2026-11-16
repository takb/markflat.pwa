import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { hashFor, parseHash, useUi } from '@/stores/ui'

const popped = () => new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }))

describe('views have addresses', () => {
  it.each([
    ['', 'list', null, 0],
    ['#/', 'list', null, 0],
    ['#/song/let_it_be', 'show', 'let_it_be', 0],
    ['#/edit/new_song_2', 'edit', 'new_song_2', 0],
    ['#/history/yesterday', 'history', 'yesterday', 0],
    ['#/keys', 'keys', null, 0],
    ['#/deleted', 'deleted', null, 0],
    ['#/set/ab12', 'set', 'ab12', 0],
    ['#/set/ab12/3', 'set', 'ab12', 3],
    ['#/set/ab12/x', 'set', 'ab12', 0],
    ['#/song/x/3', 'show', 'x', 0],
    ['#/song', 'list', null, 0],
    ['#/nonsense/x', 'list', null, 0],
  ])('%s → %s %s %d', (hash, view, selected, page) => {
    expect(parseHash(hash)).toEqual({ view, selected, page })
  })

  it('round-trips', () => {
    expect(parseHash(hashFor('show', 'a b'))).toEqual({ view: 'show', selected: 'a b', page: 0 })
    expect(parseHash(hashFor('set', 'l1', 4))).toEqual({ view: 'set', selected: 'l1', page: 4 })
  })
})

describe('back goes back within the app (D7)', () => {
  beforeEach(() => {
    history.replaceState(null, '', '#/')
    setActivePinia(createPinia())
  })

  it('steps back through the views, and home skips to the list', async () => {
    const ui = useUi()
    ui.show('yesterday')
    ui.edit('yesterday')
    expect([ui.view, ui.selected]).toEqual(['edit', 'yesterday'])

    let p = popped()
    ui.back()
    await p
    expect([ui.view, ui.selected]).toEqual(['show', 'yesterday'])

    ui.edit('yesterday')
    ui.history('yesterday')
    p = popped()
    ui.home()
    await p
    expect(ui.view).toBe('list')
    expect(location.hash).toBe('#/')
  })

  it('a set list: the first song page is one step, turning songs replaces it, back returns to the list (L10)', async () => {
    const ui = useUi()
    ui.openSet('l1')
    const length = history.length
    ui.setPage(1)
    ui.setPage(2)
    ui.setPage(3)
    expect([ui.view, ui.selected, ui.page, history.length]).toEqual(['set', 'l1', 3, length + 1])

    let p = popped()
    ui.back()
    await p
    expect([ui.view, ui.page]).toEqual(['set', 0])

    ui.setPage(2)
    p = popped()
    ui.setPage(0) // swiped back to the list page: the song step is taken back
    await p
    expect([ui.page, history.length]).toEqual([0, length + 1])

    p = popped()
    ui.back()
    await p
    expect(ui.view).toBe('list')
  })

  it('switching lists on the list page replaces the step', () => {
    const ui = useUi()
    ui.openSet('l1')
    const length = history.length
    ui.openSet('l2')
    expect([ui.selected, history.length]).toEqual(['l2', length])
  })

  it('a renamed song keeps its place', () => {
    const ui = useUi()
    ui.edit('new_song')
    const length = history.length
    ui.renamed('wonderwall')
    expect([ui.view, ui.selected, history.length]).toEqual(['edit', 'wonderwall', length])
  })

  it('on the first page of the app, back goes to the list, not out of the app', () => {
    history.replaceState(null, '', '#/song/yesterday')
    setActivePinia(createPinia())
    const ui = useUi()
    expect(ui.view).toBe('show')
    ui.back()
    expect(ui.view).toBe('list')
  })
})
