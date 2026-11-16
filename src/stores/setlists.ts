import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { fold } from '@/lib/search'
import { storage } from '@/lib/storage'
import { useSongbook } from './songbook'

// Set lists (plan "set lists", L1–L4, L10): named, ordered lists of songs, kept on this device
// only. An entry points to a song by its file name and remembers the song's title, so it can be
// relinked when the file name changes elsewhere, and shown as missing when the song is gone.

export interface SetEntry {
  /** unique within the list: the same song may appear twice */
  id: string
  slug: string
  /** the song's title when last seen: for relinking and for showing a missing entry */
  title: string
  /** semitones, remembered while playing the list (L4) */
  transpose: number
}

export interface SetList {
  id: string
  name: string
  entries: SetEntry[]
  /** last change, ISO time */
  changed: string
}

const STORAGE_KEY = 'markflat.setlists'

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const now = () => new Date().toISOString()

export const useSetlists = defineStore('setlists', () => {
  const lists = ref<SetList[]>(load())
  const songbook = useSongbook()

  watch(lists, l => storage.set(STORAGE_KEY, JSON.stringify(l)), { deep: true })

  const byId = computed(() => Object.fromEntries(lists.value.map(l => [l.id, l])))
  const get = (id: string | null | undefined): SetList | undefined => (id ? byId.value[id] : undefined)

  function touch(list: SetList) {
    list.changed = now()
  }

  function create(name: string): string {
    const list: SetList = { id: newId(), name: name.trim() || 'New list', entries: [], changed: now() }
    lists.value.push(list)
    return list.id
  }

  function rename(id: string, name: string) {
    const list = get(id)
    if (!list || !name.trim()) return
    list.name = name.trim()
    touch(list)
  }

  /** A copy with its own entries (e.g. the next gig's list from this one); returns its id. */
  function duplicate(id: string): string | undefined {
    const list = get(id)
    if (!list) return undefined
    const copy: SetList = {
      id: newId(),
      name: list.name + ' (copy)',
      entries: list.entries.map(e => ({ ...e, id: newId() })),
      changed: now(),
    }
    lists.value.splice(lists.value.indexOf(list) + 1, 0, copy)
    return copy.id
  }

  function remove(id: string) {
    lists.value = lists.value.filter(l => l.id !== id)
  }

  function entryFor(slug: string): SetEntry | undefined {
    const song = songbook.songs[slug]
    return song ? { id: newId(), slug, title: song.title || slug, transpose: 0 } : undefined
  }

  /** Adds a song at the end (the same song may be in a list twice). */
  function add(id: string, slug: string) {
    const list = get(id)
    const entry = entryFor(slug)
    if (!list || !entry) return
    list.entries.push(entry)
    touch(list)
  }

  function removeEntry(id: string, entryId: string) {
    const list = get(id)
    if (!list) return
    list.entries = list.entries.filter(e => e.id !== entryId)
    touch(list)
  }

  /** Moves an entry from one position to another (drag and drop). */
  function move(id: string, from: number, to: number) {
    const list = get(id)
    if (!list || from === to || from < 0 || to < 0 || from >= list.entries.length || to >= list.entries.length) return
    const [entry] = list.entries.splice(from, 1)
    list.entries.splice(to, 0, entry)
    touch(list)
  }

  /** Puts another song in an entry's place (for a missing one); its key starts at 0. */
  function replace(id: string, entryId: string, slug: string) {
    const list = get(id)
    const entry = list?.entries.find(e => e.id === entryId)
    const fresh = entryFor(slug)
    if (!list || !entry || !fresh) return
    Object.assign(entry, { slug: fresh.slug, title: fresh.title, transpose: 0 })
    touch(list)
  }

  function setTranspose(id: string, entryId: string, transpose: number) {
    const entry = get(id)?.entries.find(e => e.id === entryId)
    if (entry) entry.transpose = transpose
  }

  const isMissing = (entry: SetEntry) => !songbook.songs[entry.slug]

  /** A song got a new file name on this device (saved under a new title): the lists follow. */
  function followRename(from: string, to: string) {
    for (const list of lists.value) {
      for (const e of list.entries) if (e.slug === from) e.slug = to
    }
  }

  /**
   * After the songbook changed (a download): a missing entry relinks to the one song with its
   * remembered title, if there is exactly one; titles of present songs are kept up to date.
   */
  function relink() {
    const songs = songbook.list
    for (const list of lists.value) {
      for (const e of list.entries) {
        const song = songbook.songs[e.slug]
        if (song) {
          if (song.title && song.title !== e.title) e.title = song.title
          continue
        }
        const wanted = fold(e.title)
        const matches = songs.filter(s => fold(s.title) === wanted)
        if (matches.length === 1) e.slug = matches[0].slug
      }
    }
  }

  watch(() => Object.keys(songbook.songs).join('\n'), relink, { immediate: true })

  return {
    lists, get, create, rename, duplicate, remove, add, removeEntry, move, replace, setTranspose,
    isMissing, followRename, relink,
  }
})

function load(): SetList[] {
  try {
    const data = JSON.parse(storage.get(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(data)) return []
    return data.filter((l): l is SetList => typeof l?.id === 'string' && typeof l?.name === 'string' && Array.isArray(l?.entries))
      .map(l => ({
        id: l.id,
        name: l.name,
        changed: typeof l.changed === 'string' ? l.changed : now(),
        entries: l.entries.filter(e => typeof e?.slug === 'string').map(e => ({
          id: typeof e.id === 'string' ? e.id : newId(),
          slug: e.slug,
          title: typeof e.title === 'string' ? e.title : e.slug,
          transpose: Number.isInteger(e.transpose) ? e.transpose : 0,
        })),
      }))
  } catch {
    return []
  }
}
