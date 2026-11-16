import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { compareVersions, noChanges, type RemoteChanges } from '@/lib/remote'
import { useSettings } from './settings'
import { useSongbook } from './songbook'

// Songs changed elsewhere: the server's ETags, fetched now and then (composables/remotePolling),
// against this device's copies. A notice offers to sync; dismissed, it comes back only when
// something else changes.
export const useRemote = defineStore('remote', () => {
  const settings = useSettings()
  const songbook = useSongbook()
  /** the server's ETags at the last check, null before the first */
  const server = ref<Record<string, string> | null>(null)
  /** the ETag of that list: an unchanged list is not sent again */
  let listEtag: string | null = null
  const dismissed = ref<string | null>(null)
  let busy = false

  const changes = computed<RemoteChanges>(() => {
    if (!server.value) return { changed: [], added: [], removed: [] }
    const c = compareVersions(songbook.songs, server.value)
    // a song changed on both sides is in the conflict dialog already
    const conflicted = new Set(songbook.conflicts.map(x => x.slug))
    return { ...c, changed: c.changed.filter(s => !conflicted.has(s)) }
  })
  const count = computed(() => changes.value.changed.length + changes.value.added.length + changes.value.removed.length)
  // what was dismissed: these changes, these versions (a song changed again shows again)
  const signature = computed(() => JSON.stringify([changes.value, changes.value.changed.map(s => server.value?.[s])]))
  const visible = computed(() => !noChanges(changes.value) && dismissed.value !== signature.value)

  const title = (slug: string) => songbook.songs[slug]?.title || slug
  /** e.g. "Yesterday, Zeta Song changed · 1 new · 1 deleted" */
  const summary = computed(() => {
    const c = changes.value
    const names = c.changed.slice(0, 3).map(title).join(', ') + (c.changed.length > 3 ? ' and ' + (c.changed.length - 3) + ' more' : '')
    return [
      c.changed.length && names + ' changed',
      c.added.length && c.added.length + ' new',
      c.removed.length && c.removed.length + ' deleted',
    ].filter(Boolean).join(' · ')
  })

  /** Asks the server, quietly: offline, a refused key or anything else just waits for the next check. */
  async function check() {
    if (busy || !settings.key || !Object.keys(songbook.songs).length) return
    busy = true
    try {
      const r = await settings.api.versions(listEtag)
      if (r) {
        server.value = r.versions
        listEtag = r.etag
      }
    } catch {
      // next time
    } finally {
      busy = false
    }
  }

  const dismiss = () => { dismissed.value = signature.value }
  const isChanged = (slug: string | null) => !!slug && changes.value.changed.includes(slug)

  // another key may see another songbook: start over
  watch(() => settings.key, () => {
    server.value = null
    listEtag = null
  })

  return { changes, count, visible, summary, check, dismiss, isChanged }
})
