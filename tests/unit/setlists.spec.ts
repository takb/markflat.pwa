import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettings } from '@/stores/settings'
import { useSetlists } from '@/stores/setlists'
import { useSongbook } from '@/stores/songbook'
import { installFakeApi, type FakeApi } from './fake-api'

let api: FakeApi

const fresh = async () => {
  setActivePinia(createPinia())
  useSettings().setKey('writer-key')
  const songbook = useSongbook()
  await songbook.sync()
  return { songbook, sets: useSetlists() }
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  api = installFakeApi({
    let_it_be: '# Let It Be - The Beatles\n1. v1',
    yesterday: '# Yesterday - The Beatles',
    wonderwall: '# Wonderwall - Oasis',
  })
})

describe('set lists', () => {
  it('makes a list, adds songs (also twice), reorders and keeps it across reloads', async () => {
    const { sets } = await fresh()
    const id = sets.create('  Gig Wohnzimmerkonzert 12.12. ')
    sets.add(id, 'yesterday')
    sets.add(id, 'let_it_be')
    sets.add(id, 'yesterday')
    sets.move(id, 2, 0)
    const list = sets.get(id)!
    expect(list.name).toBe('Gig Wohnzimmerkonzert 12.12.')
    expect(list.entries.map(e => e.slug)).toEqual(['yesterday', 'yesterday', 'let_it_be'])
    expect(new Set(list.entries.map(e => e.id)).size).toBe(3)
    expect(list.entries[2].title).toBe('Let It Be')

    await nextTick() // saved after the change, as the songbook is
    setActivePinia(createPinia())
    expect(useSetlists().get(id)?.entries.map(e => e.slug)).toEqual(['yesterday', 'yesterday', 'let_it_be'])
  })

  it('removes entries, renames, duplicates with separate entries, deletes', async () => {
    const { sets } = await fresh()
    const id = sets.create('A')
    sets.add(id, 'yesterday')
    sets.add(id, 'wonderwall')
    sets.removeEntry(id, sets.get(id)!.entries[0].id)
    sets.rename(id, 'B')
    sets.rename(id, '   ')
    const copy = sets.duplicate(id)!
    sets.setTranspose(copy, sets.get(copy)!.entries[0].id, 2)

    expect(sets.lists.map(l => l.name)).toEqual(['B', 'B (copy)'])
    expect(sets.get(id)!.entries.map(e => [e.slug, e.transpose])).toEqual([['wonderwall', 0]])
    expect(sets.get(copy)!.entries.map(e => [e.slug, e.transpose])).toEqual([['wonderwall', 2]])
    sets.remove(id)
    expect(sets.lists.map(l => l.id)).toEqual([copy])
  })

  it('follows a song renamed on this device', async () => {
    const { songbook, sets } = await fresh()
    const id = sets.create('A')
    sets.add(id, 'let_it_be')
    songbook.setContent('let_it_be', '# Let It Go - The Beatles\n1. v1')
    await songbook.save('let_it_be')
    expect(sets.get(id)!.entries.map(e => [e.slug, e.title])).toEqual([['let_it_go', 'Let It Go']])
    expect(sets.isMissing(sets.get(id)!.entries[0])).toBe(false)
  })

  it('relinks by title after a download, else shows the entry as missing until replaced', async () => {
    const { songbook, sets } = await fresh()
    const id = sets.create('A')
    sets.add(id, 'yesterday')
    sets.add(id, 'wonderwall')
    // elsewhere: Yesterday got a new file name (same title), Wonderwall was deleted
    api.songs.set('yesterday_beatles', api.songs.get('yesterday')!)
    api.songs.delete('yesterday')
    api.songs.delete('wonderwall')
    await songbook.sync()
    await Promise.resolve()

    const [yesterday, wonderwall] = sets.get(id)!.entries
    expect(yesterday.slug).toBe('yesterday_beatles')
    expect(sets.isMissing(yesterday)).toBe(false)
    expect(sets.isMissing(wonderwall)).toBe(true)
    expect(wonderwall.title).toBe('Wonderwall')

    sets.setTranspose(id, wonderwall.id, 3)
    sets.replace(id, wonderwall.id, 'let_it_be')
    expect(sets.get(id)!.entries[1]).toMatchObject({ slug: 'let_it_be', title: 'Let It Be', transpose: 0 })
  })

  it('does not relink when the title is ambiguous', async () => {
    const { songbook, sets } = await fresh()
    const id = sets.create('A')
    sets.add(id, 'yesterday')
    api.songs.set('yesterday_1', '# Yesterday - Someone')
    api.songs.set('yesterday_2', '# Yesterday - Someone else')
    api.songs.delete('yesterday')
    await songbook.sync()
    await Promise.resolve()
    expect(sets.isMissing(sets.get(id)!.entries[0])).toBe(true)
  })

  it('ignores a broken stored value', async () => {
    localStorage.setItem('markflat.setlists', '{not json')
    const { sets } = await fresh()
    expect(sets.lists).toEqual([])
  })
})
