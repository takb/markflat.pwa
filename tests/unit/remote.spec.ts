import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { watch } from 'vue'
import { compareVersions } from '@/lib/remote'
import { useRemote } from '@/stores/remote'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { installFakeApi, type FakeApi } from './fake-api'

describe('compareVersions', () => {
  it('finds songs changed, added and removed elsewhere, never songs only this device has', () => {
    const local = { a: { etag: '1' }, b: { etag: '2' }, c: { etag: '3' }, mine: { etag: null } }
    expect(compareVersions(local, { a: '1', b: '2x', d: '4' })).toEqual({ changed: ['b'], added: ['d'], removed: ['c'] })
    expect(compareVersions(local, { a: '1', b: '2', c: '3' })).toEqual({ changed: [], added: [], removed: [] })
  })
})

describe('remote store', () => {
  let api: FakeApi
  const setup = async () => {
    setActivePinia(createPinia())
    useSettings().setKey('writer-key')
    const songbook = useSongbook()
    await songbook.sync()
    return { songbook, remote: useRemote() }
  }

  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    api = installFakeApi({ let_it_be: '# Let It Be - The Beatles\n1. v1', yesterday: '# Yesterday - The Beatles' })
  })

  it('notices a song changed elsewhere, and sync clears it', async () => {
    const { songbook, remote } = await setup()
    await remote.check()
    expect(remote.visible).toBe(false)

    api.songs.set('yesterday', '# Yesterday - The Beatles\n1. from elsewhere')
    api.songs.set('new_one', '# New One - X')
    await remote.check()
    expect(remote.visible).toBe(true)
    expect(remote.summary).toBe('Yesterday changed · 1 new')
    expect(remote.isChanged('yesterday')).toBe(true)

    await songbook.sync()
    expect(remote.visible).toBe(false)
    expect(remote.count).toBe(0)
  })

  it('does not count this device\'s own saves', async () => {
    const { songbook, remote } = await setup()
    songbook.setContent('yesterday', '# Yesterday - The Beatles\n1. mine')
    await songbook.save('yesterday')
    await remote.check()
    expect(remote.count).toBe(0)
  })

  it('asks with the list\'s ETag, and an unchanged list is not sent again', async () => {
    const { remote } = await setup()
    await remote.check()
    await remote.check()
    expect(api.calls.filter(c => c === 'GET /versions')).toHaveLength(2)
    api.songs.set('yesterday', 'changed')
    await remote.check()
    expect(remote.count).toBe(1)
  })

  it('stays dismissed until something else changes', async () => {
    const { remote } = await setup()
    api.songs.set('yesterday', '# Yesterday - The Beatles\n1. v2')
    await remote.check()
    remote.dismiss()
    expect(remote.visible).toBe(false)
    await remote.check()
    expect(remote.visible).toBe(false)
    expect(remote.count).toBe(1) // still offered in the player's menu

    api.songs.set('yesterday', '# Yesterday - The Beatles\n1. v3')
    await remote.check()
    expect(remote.visible).toBe(true)
  })

  it('does not mistake its own save for a change elsewhere when a check overlaps it', async () => {
    const { songbook, remote } = await setup()
    await remote.check() // the server's list as it was
    songbook.setContent('yesterday', '# Yesterday - The Beatles\n1. mine')
    // the save starts first and ends before the check's answer (made with the old list) arrives
    const saving = songbook.save('yesterday')
    const seen: boolean[] = []
    const stop = watch(() => remote.visible, v => seen.push(v), { flush: 'sync' })
    await saving
    expect(remote.visible).toBe(false) // never with the old list against the new save
    await new Promise(r => setTimeout(r, 0))
    expect(remote.count).toBe(0)
    expect(seen).not.toContain(true)
    stop()
  })

  it('does not show a song renamed by its own save as new and deleted', async () => {
    const { songbook, remote } = await setup()
    await remote.check()
    songbook.setContent('yesterday', '# Yesterday Once More - The Beatles')
    const saving = songbook.save('yesterday')
    await remote.check() // while the rename is on its way
    expect(remote.visible).toBe(false)
    await saving
    await new Promise(r => setTimeout(r, 0))
    expect(remote.count).toBe(0)
  })

  it('stays quiet offline', async () => {
    const { remote } = await setup()
    api.online = false
    await expect(remote.check()).resolves.toBeUndefined()
    expect(remote.count).toBe(0)
  })
})
