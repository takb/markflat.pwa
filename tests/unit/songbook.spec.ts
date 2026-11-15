import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { installFakeApi, type FakeApi } from './fake-api'

let api: FakeApi

const fresh = async () => {
  setActivePinia(createPinia())
  useSettings().setKey('writer-key')
  const songbook = useSongbook()
  await songbook.sync()
  return songbook
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  api = installFakeApi({ let_it_be: '# Let It Be - The Beatles\n1. v1', yesterday: '# Yesterday - The Beatles' })
})

describe('songbook store', () => {
  it('downloads the songbook and keeps it across reloads', async () => {
    const songbook = await fresh()
    expect(songbook.list.map(s => s.slug)).toEqual(['let_it_be', 'yesterday'])

    setActivePinia(createPinia())
    expect(Object.keys(useSongbook().songs)).toEqual(['let_it_be', 'yesterday'])
  })

  it('marks a song as changed only while it differs from the server (B1)', async () => {
    const songbook = await fresh()
    expect(songbook.changed('yesterday')).toBe(false)
    songbook.setContent('yesterday', '# Yesterday - The Beatles\n1. new')
    expect(songbook.changed('yesterday')).toBe(true)
    expect(songbook.songs.yesterday.title).toBe('Yesterday')
    expect((await songbook.save('yesterday')).status).toBe('saved')
    expect(songbook.changed('yesterday')).toBe(false)
    expect(api.songs.get('yesterday')).toBe('# Yesterday - The Beatles\n1. new')
  })

  it('names a new song after its title and never reuses another song\'s id (B3)', async () => {
    const songbook = await fresh()
    const slug = songbook.create()
    expect(songbook.create()).not.toBe(slug)
    songbook.setContent(slug, '# Wonderwall - Oasis')
    expect(await songbook.save(slug)).toEqual({ status: 'saved', slug: 'wonderwall' })
    expect(api.songs.has('wonderwall')).toBe(true)
    expect(songbook.songs[slug]).toBeUndefined()
  })

  it('renames a song on the server when its title changes (B6)', async () => {
    const songbook = await fresh()
    songbook.setContent('let_it_be', '# Let It Go - The Beatles\n1. v1')
    expect(await songbook.save('let_it_be')).toEqual({ status: 'saved', slug: 'let_it_go' })
    expect([...api.songs.keys()].sort()).toEqual(['let_it_go', 'yesterday'])
    expect(api.calls).toContain('POST /songs/let_it_be/rename')
  })

  it('keeps a song\'s name when its heading is gone', async () => {
    const songbook = await fresh()
    songbook.setContent('yesterday', 'no heading any more')
    expect(await songbook.save('yesterday')).toEqual({ status: 'saved', slug: 'yesterday' })
    expect(api.calls.some(c => c.includes('rename'))).toBe(false)
  })

  it('turns a save over someone else\'s change into a conflict and settles it', async () => {
    const songbook = await fresh()
    api.songs.set('yesterday', '# Yesterday - The Beatles\n1. theirs')
    songbook.setContent('yesterday', '# Yesterday - The Beatles\n1. mine')

    expect((await songbook.save('yesterday')).status).toBe('conflict')
    expect(songbook.conflicts).toHaveLength(1)
    expect(songbook.conflicts[0].theirs?.content).toContain('theirs')
    expect(api.songs.get('yesterday')).toContain('theirs')

    await songbook.resolve('yesterday', 'mine')
    expect(api.songs.get('yesterday')).toContain('mine')
    expect(songbook.conflicts).toEqual([])
    expect(songbook.changed('yesterday')).toBe(false)
  })

  it('takes the server\'s version when asked', async () => {
    const songbook = await fresh()
    api.songs.set('yesterday', 'theirs')
    songbook.setContent('yesterday', 'mine')
    await songbook.save('yesterday')
    await songbook.resolve('yesterday', 'theirs')
    expect(songbook.songs.yesterday.content).toBe('theirs')
  })

  it('keeps a change on this device when offline and uploads it later', async () => {
    const songbook = await fresh()
    api.online = false
    songbook.setContent('yesterday', 'offline edit')
    expect((await songbook.save('yesterday')).status).toBe('local')
    expect(songbook.pending.map(s => s.slug)).toEqual(['yesterday'])

    api.online = true
    expect(await songbook.uploadPending()).toEqual({ saved: 1, conflicts: 0 })
    expect(api.songs.get('yesterday')).toBe('offline edit')
  })

  it('deletes on the server, and refuses when the song changed there', async () => {
    const songbook = await fresh()
    await songbook.remove('yesterday')
    expect(api.songs.has('yesterday')).toBe(false)
    expect(songbook.songs.yesterday).toBeUndefined()

    api.songs.set('let_it_be', 'changed meanwhile')
    await expect(songbook.remove('let_it_be')).rejects.toMatchObject({ status: 412 })
    expect(songbook.songs.let_it_be.content).toBe('changed meanwhile')
  })

  it('takes over the old app\'s songbook once and drops its dead keys', async () => {
    localStorage.setItem('songbook', JSON.stringify([
      { id: 0, title: 'Yesterday', artist: 'The Beatles', content: '# Yesterday - The Beatles\nold copy' },
      { id: 1, title: 'Only Here', artist: 'Me', content: '# Only Here - Me' },
    ]))
    localStorage.setItem('apiKeyRead', 'old')
    const songbook = await fresh()

    expect(songbook.songs.yesterday.content).toBe('# Yesterday - The Beatles')
    expect(songbook.songs.only_here.content).toBe('# Only Here - Me')
    expect(songbook.pending.map(s => s.slug)).toEqual(['only_here'])
    expect(localStorage.getItem('songbook')).toBeNull()
    expect(localStorage.getItem('apiKeyRead')).toBeNull()
  })

  it('restores an old version, also of a deleted song (D6)', async () => {
    const songbook = await fresh()
    api.revisions.set('yesterday', [['r1', '# Yesterday - The Beatles\n1. old']])
    await songbook.restore('yesterday', 'r1')
    expect(api.songs.get('yesterday')).toBe('# Yesterday - The Beatles\n1. old')
    expect(songbook.songs.yesterday.content).toBe('# Yesterday - The Beatles\n1. old')
    expect(songbook.changed('yesterday')).toBe(false)

    api.revisions.set('gone', [['r2', '# Gone - Someone']])
    await songbook.restore('gone', 'r2')
    expect(songbook.songs.gone.content).toBe('# Gone - Someone')
  })

  it('a restore over a newer server version shows that version instead', async () => {
    const songbook = await fresh()
    api.revisions.set('yesterday', [['r1', 'old']])
    api.songs.set('yesterday', 'newer elsewhere')
    await expect(songbook.restore('yesterday', 'r1')).rejects.toMatchObject({ status: 412 })
    expect(songbook.songs.yesterday.content).toBe('newer elsewhere')
  })

  it('keeps everything local without a key', async () => {
    const songbook = await fresh()
    useSettings().setKey('')
    songbook.setContent('yesterday', 'x')
    expect((await songbook.save('yesterday')).status).toBe('local')
  })
})
