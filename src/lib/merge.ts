import type { ServerSong } from '@/api/client'

/** A song as the app keeps it: its text, and the server's text and ETag at the last sync. */
export interface LocalSong {
  slug: string
  title: string
  artist: string
  content: string
  /** the server's content at the last sync or save; null for a song the server never had */
  base: string | null
  /** the server's ETag at the last sync or save; null for a song the server never had */
  etag: string | null
}

/** Both versions of a song that changed here and on the server. */
export interface Conflict {
  slug: string
  mine: string
  /** the server's version, or null if it was deleted there */
  theirs: ServerSong | null
}

export interface MergeResult {
  songs: Record<string, LocalSong>
  conflicts: Conflict[]
  added: number
  updated: number
  removed: number
  /** songs with changes not on the server (edited here, or never uploaded) */
  pending: number
}

export const isChanged = (s: LocalSong): boolean => s.content !== s.base

export const fromServer = (s: ServerSong): LocalSong =>
  ({ slug: s.slug, title: s.title, artist: s.artist, content: s.content, base: s.content, etag: s.etag })

/**
 * Merges the server's songbook into the local one (B4: nothing local is lost).
 *
 * - new on the server → added; changed there and not here → updated
 * - changed here only → kept (pending upload)
 * - changed on both sides → kept as it is here, and reported as a conflict
 * - deleted on the server: unchanged here → removed; changed here → kept as a new local song
 * - never uploaded → kept (pending upload)
 */
export function merge(local: Record<string, LocalSong>, server: ServerSong[]): MergeResult {
  const songs: Record<string, LocalSong> = {}
  const conflicts: Conflict[] = []
  let added = 0
  let updated = 0
  let removed = 0
  const onServer = new Set<string>()

  for (const s of server) {
    onServer.add(s.slug)
    const mine = local[s.slug]
    if (!mine) {
      songs[s.slug] = fromServer(s)
      added++
    } else if (mine.content === s.content) {
      songs[s.slug] = fromServer(s)
    } else if (!isChanged(mine)) {
      songs[s.slug] = fromServer(s)
      updated++
    } else if (mine.etag === s.etag) {
      songs[s.slug] = mine
    } else {
      songs[s.slug] = mine
      conflicts.push({ slug: s.slug, mine: mine.content, theirs: s })
    }
  }
  for (const mine of Object.values(local)) {
    if (onServer.has(mine.slug)) continue
    if (mine.etag !== null && !isChanged(mine)) {
      removed++
    } else {
      songs[mine.slug] = { ...mine, base: null, etag: null }
    }
  }
  const pending = Object.values(songs).filter(isChanged).length

  return { songs, conflicts, added, updated, removed, pending }
}
