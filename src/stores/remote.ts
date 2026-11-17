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
    if (!server.value || stale.value) return { changed: [], added: [], removed: [] }
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

  // Uploads from here change both sides: a check that overlaps one could see the server before
  // and this device after it (or the other way round) and take the device's own save for a
  // change made elsewhere. So a check waits while one is under way, an answer that overlapped
  // one is dropped, and every upload is followed by a fresh check.
  let writes = 0
  /** an upload changed things since the last answer: the list is not to be trusted until a new one */
  const stale = ref(false)
  watch(() => songbook.busy, (now, before) => {
    if (now > before) {
      writes++
      stale.value = true
    } else if (now === 0) check()
  })

  /** Asks the server, quietly: offline, a refused key or anything else just waits for the next check. */
  async function check() {
    if (busy || songbook.busy || !settings.key || !Object.keys(songbook.songs).length) return
    busy = true
    const started = writes
    let dropped = false
    try {
      // after an upload the list has changed: ask for all of it, not "unchanged since"
      const r = await settings.api.versions(stale.value ? null : listEtag)
      if (writes !== started || songbook.busy) {
        dropped = true
      } else {
        if (r) {
          server.value = r.versions
          listEtag = r.etag
        }
        stale.value = false
      }
    } catch {
      // next time
    } finally {
      busy = false
    }
    // an answer from before an upload: ask again, now that it is done
    if (dropped && !songbook.busy) check()
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
