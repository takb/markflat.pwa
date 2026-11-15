import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Song } from '@/composables/store'

// The store is a module singleton that reads localStorage when it is imported, so every test
// prepares localStorage first and then imports a fresh copy.
const song = (id: number, title = 'Song ' + id): Song =>
  ({ id, title, artist: 'Artist', content: '# ' + title + ' - Artist\n1. text' })
const fresh = async (songbook: Song[] = []) => {
  localStorage.setItem('songbook', JSON.stringify(songbook))
  vi.resetModules()
  return (await import('@/composables/store')).default
}

beforeEach(() => localStorage.clear())

describe('store', () => {
  it('loads the songbook and the API keys from localStorage', async () => {
    localStorage.setItem('apiKeyRead', 'r')
    localStorage.setItem('apiKeyWrite', 'w')
    const store = await fresh([song(0), song(1)])
    expect(store.songbook.map(s => s.id)).toEqual([0, 1])
    expect([store.apiKeyRead, store.apiKeyWrite]).toEqual(['r', 'w'])
  })

  it('starts empty without localStorage', async () => {
    vi.resetModules()
    const store = (await import('@/composables/store')).default
    expect(store.songbook).toEqual([])
    expect([store.apiKeyRead, store.apiKeyWrite]).toEqual(['', ''])
  })

  it('selects a song by id for showing and editing', async () => {
    const store = await fresh([song(3), song(7)])
    store.show(7)
    expect([store.view, store.selected?.title]).toEqual(['show', 'Song 7'])
    store.edit(3)
    expect([store.view, store.selected?.title]).toEqual(['edit', 'Song 3'])
    store.show(99)
    expect(store.selected).toBeNull()
  })

  it('takes title and artist from the heading while editing', async () => {
    const store = await fresh([song(0)])
    store.edit(0)
    store.setContent('# Let It Be - The Beatles\n1. text')
    expect([store.selected?.title, store.selected?.artist]).toEqual(['Let It Be', 'The Beatles'])
    // Characterisation (B7): the capo note stays in the artist, and a hyphen in the artist
    // splits there instead of at " - ".
    store.setContent('# Let It Be - The Beatles (Capo 2)')
    expect(store.selected?.artist).toBe('The Beatles (Capo 2)')
    store.setContent('# Song - Jay-Z')
    expect([store.selected?.title, store.selected?.artist]).toEqual(['Song - Jay', 'Z'])
  })

  it('saves the selected song in place of the old copy and persists the songbook', async () => {
    const store = await fresh([song(0), song(1)])
    store.edit(0)
    store.setContent('# Renamed - Artist')
    store.saveSong()
    expect(store.songbook.map(s => [s.id, s.title])).toEqual([[1, 'Song 1'], [0, 'Renamed']])
    expect(JSON.parse(localStorage.getItem('songbook')!)).toHaveLength(2)
  })

  it('deletes the selected song (locally only; persisting is the caller\'s job)', async () => {
    const store = await fresh([song(0), song(1)])
    store.edit(1)
    store.deleteSong()
    expect(store.songbook.map(s => s.id)).toEqual([0])
    expect(store.selected).toBeNull()
  })

  it('stores and reloads the API keys', async () => {
    const store = await fresh()
    store.apiKeyRead = 'read'
    store.apiKeyWrite = 'write'
    store.saveApiKeys()
    store.apiKeyRead = ''
    store.loadApiKeys()
    expect(store.apiKeyRead).toBe('read')
  })

  it('adds a new song with a template and opens the editor', async () => {
    const store = await fresh([song(0)])
    store.addSong()
    expect([store.view, store.selected?.id, store.selected?.title]).toEqual(['edit', 1, 'New song'])
  })

  it.fails('B3: a new song gets an id no other song has', async () => {
    const store = await fresh([song(1), song(2)]) // song 0 was deleted: length 2 = an existing id
    store.addSong()
    expect(store.songbook.map(s => s.id)).not.toContain(store.selected?.id)
  })
})
