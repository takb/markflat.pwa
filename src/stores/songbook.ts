import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { ApiError, type ServerSong } from '@/api/client'
import { fromServer, isChanged, merge, type Conflict, type LocalSong, type MergeResult } from '@/lib/merge'
import { parseHeading, slugFor } from '@/lib/song'
import { storage } from '@/lib/storage'
import { useSettings } from './settings'
import { useSetlists } from './setlists'

const STORAGE_KEY = 'markflat.songbook'
const TEMPLATE = '# New song - Artist\n1. Verse  \n~Ch Chorus  \n'

/** What a save did: uploaded, kept on this device only (offline or no write key), or a conflict. */
export type SaveResult = { status: 'saved' | 'local' | 'conflict', slug: string }

export const useSongbook = defineStore('songbook', () => {
  const songs = ref<Record<string, LocalSong>>(load())
  const conflicts = ref<Conflict[]>([])

  const list = computed(() => Object.values(songs.value))
  const pending = computed(() => list.value.filter(isChanged))

  watch(songs, s => storage.set(STORAGE_KEY, JSON.stringify(Object.values(s))), { deep: true })

  const changed = (slug: string) => {
    const s = songs.value[slug]
    return s ? isChanged(s) : false
  }

  function freeSlug(wanted: string, except?: string): string {
    let slug = wanted
    for (let n = 2; songs.value[slug] && slug !== except; n++) slug = wanted + '_' + n
    return slug
  }

  function create(): string {
    const slug = freeSlug('new_song')
    songs.value[slug] = { slug, title: 'New song', artist: 'Artist', content: TEMPLATE, base: null, etag: null }
    return slug
  }

  function setContent(slug: string, content: string) {
    const s = songs.value[slug]
    if (!s) return
    s.content = content
    Object.assign(s, parseHeading(content))
  }

  /** Puts a song back to the server's version (a song the server never had stays as it is). */
  function reset(slug: string) {
    const s = songs.value[slug]
    if (s && s.base !== null) setContent(slug, s.base)
  }

  function move(from: string, to: string) {
    if (from === to) return
    const s = songs.value[from]
    delete songs.value[from]
    songs.value[to] = { ...s, slug: to }
    useSetlists().followRename(from, to)
  }

  function accept(server: ServerSong, replacing?: string) {
    if (replacing && replacing !== server.slug) delete songs.value[replacing]
    songs.value[server.slug] = fromServer(server)
  }

  /** Downloads the server's songbook and merges it in (nothing changed here is lost). */
  async function sync(): Promise<MergeResult> {
    const result = merge(songs.value, await useSettings().api.songs())
    songs.value = result.songs
    for (const c of result.conflicts) addConflict(c)
    return result
  }

  function addConflict(c: Conflict) {
    conflicts.value = [...conflicts.value.filter(x => x.slug !== c.slug), c]
  }

  /**
   * Uploads a song. A changed title renames it on the server (B6); a new song gets its name
   * from its title. If someone else changed it meanwhile, both versions go to `conflicts`.
   */
  async function save(slug: string): Promise<SaveResult> {
    const settings = useSettings()
    const api = settings.api
    let s = songs.value[slug]
    if (!s) throw new Error('No such song: ' + slug)
    if (!settings.key) return { status: 'local', slug }

    // A song without a title (heading removed or broken) keeps its name.
    const title = parseHeading(s.content).title
    const wanted = title ? slugFor(title) : slug
    try {
      if (s.etag === null) {
        // never uploaded: it takes its name from its title
        if (wanted !== slug && !songs.value[wanted]) {
          move(slug, wanted)
          slug = wanted
          s = songs.value[slug]
        }
      } else if (s.base !== null && wanted !== slugFor(parseHeading(s.base).title) && wanted !== slug) {
        // the title changed: the song moves on the server, with its history
        if (songs.value[wanted]) throw new ApiError(409, 'exists', 'A song named "' + wanted + '" exists already.')
        const renamed = await api.rename(slug, wanted, s.etag)
        move(slug, wanted)
        slug = wanted
        s = songs.value[slug]
        s.etag = renamed.etag
      }
      accept(await api.save(slug, s.content, s.etag), slug)
      return { status: 'saved', slug }
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      if (e.offline) return { status: 'local', slug }
      if (e.status === 412) {
        addConflict({ slug, mine: s.content, theirs: await serverVersion(slug) })
        return { status: 'conflict', slug }
      }
      throw e
    }
  }

  /** Uploads every song changed here; returns how many went up, and the conflicts. */
  async function uploadPending(): Promise<{ saved: number, conflicts: number }> {
    let saved = 0
    let conflicts = 0
    for (const s of [...pending.value]) {
      const r = await save(s.slug)
      if (r.status === 'saved') saved++
      if (r.status === 'conflict') conflicts++
      if (r.status === 'local') break
    }
    return { saved, conflicts }
  }

  /** Deletes a song here and on the server (the server keeps it as a revision). */
  async function remove(slug: string): Promise<void> {
    const s = songs.value[slug]
    if (!s) return
    if (s.etag !== null) {
      try {
        await useSettings().api.remove(slug, s.etag)
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 404) {
          if (e instanceof ApiError && e.status === 412) {
            const theirs = await serverVersion(slug)
            if (theirs) accept(theirs)
            throw new ApiError(412, 'conflict', 'The song changed on the server in the meantime: not deleted, the new version is shown.')
          }
          throw e
        }
      }
    }
    delete songs.value[slug]
  }

  /** Settles a conflict: keep this device's version (uploaded over the server's) or take the server's. */
  async function resolve(slug: string, keep: 'mine' | 'theirs'): Promise<void> {
    const c = conflicts.value.find(x => x.slug === slug)
    if (!c) return
    if (keep === 'theirs') {
      if (c.theirs) accept(c.theirs)
      else delete songs.value[slug]
    } else {
      accept(await useSettings().api.save(slug, c.mine, c.theirs?.etag ?? null))
    }
    conflicts.value = conflicts.value.filter(x => x.slug !== slug)
  }

  /**
   * Makes an old version current on the server (D6), also for a deleted song. This device's
   * copy is replaced by it; a stale copy gets the server's version and an error instead.
   */
  async function restore(slug: string, id: string): Promise<void> {
    const etag = songs.value[slug]?.etag ?? null
    try {
      accept(await useSettings().api.restore(slug, id, etag))
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) {
        const theirs = await serverVersion(slug)
        if (theirs) accept(theirs)
        throw new ApiError(412, 'conflict', 'The song changed on the server in the meantime: its new version is shown, try again.')
      }
      throw e
    }
  }

  async function serverVersion(slug: string): Promise<ServerSong | null> {
    try {
      return await useSettings().api.song(slug)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  }

  return { songs, conflicts, list, pending, changed, create, setContent, reset, sync, save, uploadPending, remove, resolve, restore }
})

/** The songbook from localStorage; the old app's format is taken over once. */
function load(): Record<string, LocalSong> {
  const songs: Record<string, LocalSong> = {}
  try {
    const saved = JSON.parse(storage.get(STORAGE_KEY) ?? 'null') as LocalSong[] | null
    if (Array.isArray(saved)) {
      for (const s of saved) songs[s.slug] = s
      return songs
    }
    // The old app kept [{id, title, artist, content}] and replaced it on every download, so
    // its copies count as unchanged: the next download updates them from the server, and
    // songs the server does not have stay here, offered for upload.
    const old = JSON.parse(storage.get('songbook') ?? '[]') as { title?: string, content?: string }[]
    for (const o of Array.isArray(old) ? old : []) {
      if (typeof o.content !== 'string') continue
      let slug = slugFor(parseHeading(o.content).title || o.title || '')
      for (let n = 2; songs[slug]; n++) slug = slugFor(o.title ?? '') + '_' + n
      songs[slug] = { slug, ...parseHeading(o.content), content: o.content, base: o.content, etag: null }
    }
  } catch {
    // unreadable: start empty
  }
  for (const k of ['songbook', 'apiKeyRead', 'apiKeyWrite']) storage.remove(k)
  return songs
}
