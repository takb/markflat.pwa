import { describe, expect, it } from 'vitest'
import { merge, type LocalSong } from '@/lib/merge'
import type { ServerSong } from '@/api/client'

const server = (slug: string, content: string, etag = '"' + content + '"'): ServerSong =>
  ({ slug, title: slug, artist: '', etag, content })
const synced = (slug: string, content: string): LocalSong =>
  ({ slug, title: slug, artist: '', content, base: content, etag: '"' + content + '"' })
const edited = (slug: string, base: string, content: string): LocalSong =>
  ({ ...synced(slug, base), content })
const localOnly = (slug: string, content: string): LocalSong =>
  ({ slug, title: slug, artist: '', content, base: null, etag: null })

describe('merge (B4: a download never loses what was changed here)', () => {
  it('adds new songs and updates unchanged ones', () => {
    const r = merge({ a: synced('a', 'v1') }, [server('a', 'v2'), server('b', 'b1')])
    expect(r.songs.a.content).toBe('v2')
    expect(r.songs.a.base).toBe('v2')
    expect(r.songs.b.content).toBe('b1')
    expect([r.added, r.updated, r.removed, r.pending, r.conflicts.length]).toEqual([1, 1, 0, 0, 0])
  })

  it('keeps a song changed only here, as pending', () => {
    const r = merge({ a: edited('a', 'v1', 'mine') }, [server('a', 'v1')])
    expect(r.songs.a.content).toBe('mine')
    expect(r.pending).toBe(1)
    expect(r.conflicts).toEqual([])
  })

  it('reports a song changed on both sides and keeps this side', () => {
    const r = merge({ a: edited('a', 'v1', 'mine') }, [server('a', 'theirs')])
    expect(r.songs.a.content).toBe('mine')
    expect(r.conflicts).toEqual([{ slug: 'a', mine: 'mine', theirs: server('a', 'theirs') }])
  })

  it('treats the same change on both sides as no change', () => {
    const r = merge({ a: edited('a', 'v1', 'same') }, [server('a', 'same')])
    expect(r.songs.a.base).toBe('same')
    expect([r.pending, r.conflicts.length]).toEqual([0, 0])
  })

  it('removes songs deleted on the server unless they changed here', () => {
    const r = merge({ gone: synced('gone', 'x'), kept: edited('kept', 'x', 'mine') }, [])
    expect(r.songs.gone).toBeUndefined()
    expect(r.songs.kept).toMatchObject({ content: 'mine', base: null, etag: null })
    expect([r.removed, r.pending]).toEqual([1, 1])
  })

  it('keeps songs that were never uploaded', () => {
    const r = merge({ n: localOnly('n', 'new') }, [server('a', 'a')])
    expect(r.songs.n.content).toBe('new')
    expect(r.pending).toBe(1)
  })

  it('takes the server version of an old-app copy (base = content, no ETag)', () => {
    const old: LocalSong = { slug: 'a', title: 'a', artist: '', content: 'old copy', base: 'old copy', etag: null }
    const r = merge({ a: old }, [server('a', 'current')])
    expect(r.songs.a.content).toBe('current')
    expect(r.conflicts).toEqual([])
  })
})
