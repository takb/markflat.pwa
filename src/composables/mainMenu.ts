import { computed } from 'vue'
import { ArchiveRestore, ArrowDownAZ, Download, KeyRound, Settings, Upload } from '@lucide/vue'
import { ApiError } from '@/api/client'
import type { MenuEntry } from '@/components/ui/AppMenu.vue'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'

// The ⋮ menu of the start page and of a set list's page, and its actions.
export function useMainMenu() {
  const settings = useSettings()
  const songbook = useSongbook()
  const toast = useToast()
  const ui = useUi()

  const fail = (summary: string, e: unknown) => {
    const detail = e instanceof ApiError
      ? (e.status === 401 ? 'The key was not accepted. Check it in the settings.' : e.message)
      : String(e)
    toast.add({ severity: 'error', summary, detail, life: 5000 })
  }

  async function download() {
    try {
      const r = await songbook.sync()
      const parts = [r.added && r.added + ' new', r.updated && r.updated + ' updated', r.removed && r.removed + ' removed'].filter(Boolean)
      toast.add({
        severity: 'success',
        summary: 'Songbook downloaded',
        detail: (parts.length ? parts.join(', ') : 'Everything was up to date') + '.'
          + (r.pending ? ' ' + r.pending + ' song(s) changed here are not uploaded yet.' : '')
          + (r.conflicts.length ? ' ' + r.conflicts.length + ' changed on both sides.' : ''),
        life: 5000,
      })
    } catch (e) {
      fail('Download failed', e)
    }
  }

  async function upload() {
    try {
      const r = await songbook.uploadPending()
      const left = songbook.pending.length
      toast.add({
        severity: left ? 'warn' : 'success',
        summary: 'Upload',
        detail: r.saved + ' uploaded.' + (left ? ' ' + left + ' still waiting (offline, or changed on both sides).' : ''),
        life: 5000,
      })
    } catch (e) {
      fail('Upload failed', e)
    }
  }

  const canWrite = computed(() => settings.me?.canWrite === true)

  const items = computed<MenuEntry[]>(() => [
    { label: 'Settings', icon: Settings, action: () => { ui.settingsOpen = true } },
    { label: 'Download songbook', icon: Download, action: download },
    { label: 'Upload changes (' + songbook.pending.length + ')', icon: Upload, hidden: !songbook.pending.length || settings.me?.canWrite === false, action: upload },
    { label: 'Sort by artist', icon: ArrowDownAZ, checked: settings.sortBy === 'artist', separatorBefore: true, action: () => { settings.sortBy = settings.sortBy === 'artist' ? 'title' : 'artist' } },
    { label: 'Deleted songs', icon: ArchiveRestore, hidden: !canWrite.value, separatorBefore: true, action: () => ui.deleted() },
    { label: 'Keys', icon: KeyRound, hidden: settings.me?.isAdmin !== true, action: () => ui.keys() },
  ])

  return { items, download, canWrite }
}
