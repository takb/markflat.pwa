import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { hashFor, parseHash, useUi } from '@/stores/ui'

const popped = () => new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }))

describe('views have addresses', () => {
  it.each([
    ['', 'list', null],
    ['#/', 'list', null],
    ['#/song/let_it_be', 'show', 'let_it_be'],
    ['#/edit/new_song_2', 'edit', 'new_song_2'],
    ['#/history/yesterday', 'history', 'yesterday'],
    ['#/keys', 'keys', null],
    ['#/deleted', 'deleted', null],
    ['#/song', 'list', null],
    ['#/nonsense/x', 'list', null],
  ])('%s → %s %s', (hash, view, selected) => {
    expect(parseHash(hash)).toEqual({ view, selected })
  })

  it('round-trips', () => {
    expect(parseHash(hashFor('show', 'a b'))).toEqual({ view: 'show', selected: 'a b' })
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
