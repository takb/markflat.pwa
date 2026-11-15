<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArchiveRestore, ArrowDownAZ, Download, EllipsisVertical, KeyRound, Plus, Search, Settings, Upload, X } from '@lucide/vue'
import { ApiError } from '@/api/client'
import { compareBy, matches } from '@/lib/search'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'
import AppMenu, { type MenuEntry } from './ui/AppMenu.vue'
import SettingsDialog from './SettingsDialog.vue'

// The song list (D7): one row per song, a search that stays at the top, + for writers.
const settings = useSettings()
const songbook = useSongbook()
const toast = useToast()
const ui = useUi()
const query = computed({ get: () => ui.query, set: (q: string) => { ui.query = q } })
const settingsOpen = ref(false)
const canWrite = computed(() => settings.me?.canWrite === true)

const songs = computed(() => songbook.list.filter(s => matches(s, query.value)).sort(compareBy(settings.sortBy)))

// Back from a song: where the list was.
onMounted(() => nextTick(() => window.scrollTo(0, ui.listScroll)))
onBeforeUnmount(() => { ui.listScroll = window.scrollY })

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

const items = computed<MenuEntry[]>(() => [
  { label: 'Settings', icon: Settings, action: () => { settingsOpen.value = true } },
  { label: 'Download songbook', icon: Download, action: download },
  { label: 'Upload changes (' + songbook.pending.length + ')', icon: Upload, hidden: !songbook.pending.length || settings.me?.canWrite === false, action: upload },
  { label: 'Sort by artist', icon: ArrowDownAZ, checked: settings.sortBy === 'artist', separatorBefore: true, action: () => { settings.sortBy = settings.sortBy === 'artist' ? 'title' : 'artist' } },
  { label: 'Deleted songs', icon: ArchiveRestore, hidden: !canWrite.value, separatorBefore: true, action: () => ui.deleted() },
  { label: 'Keys', icon: KeyRound, hidden: settings.me?.isAdmin !== true, action: () => ui.keys() },
])
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-2xl flex-col">
    <header class="sticky top-0 z-20 flex items-center gap-1 border-b border-line bg-bg/95 px-2 py-2 backdrop-blur">
      <AppMenu :items="items" label="Menu"><EllipsisVertical :size="20" /></AppMenu>
      <div class="relative flex-1">
        <Search :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input v-model="query" type="search" class="input pl-9 pr-8" placeholder="Search title, artist, text" aria-label="Search">
        <button v-if="query" type="button" class="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg" aria-label="Clear the search" @click="query = ''">
          <X :size="16" />
        </button>
      </div>
      <button v-if="canWrite" type="button" class="btn btn-primary btn-icon" aria-label="New song" @click="ui.edit(songbook.create())">
        <Plus :size="20" />
      </button>
    </header>

    <ul v-if="songs.length" class="divide-y divide-line">
      <li v-for="s in songs" :key="s.slug">
        <button type="button" class="song-row flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface focus-visible:bg-surface focus-visible:outline-none" :data-song="s.slug" @click="ui.show(s.slug)">
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{ s.title || s.slug }}</span>
            <span v-if="s.artist" class="block truncate text-sm text-muted">{{ s.artist }}</span>
          </span>
          <span v-if="songbook.changed(s.slug)" class="text-xs text-accent" title="Changed here, not uploaded yet" aria-label="changed here">●</span>
        </button>
      </li>
    </ul>
    <p v-else-if="songbook.list.length" class="p-6 text-center text-muted">No song matches “{{ query }}”.</p>
    <p v-else class="p-6 text-center text-muted">No songs yet: enter your key in the settings, then download the songbook.</p>

    <SettingsDialog v-model:open="settingsOpen" />
  </div>
</template>
