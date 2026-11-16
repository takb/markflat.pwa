<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import { Download, EllipsisVertical, Plus, Search, Settings, X } from '@lucide/vue'
import { useMainMenu } from '@/composables/mainMenu'
import { useVisibleSongs } from '@/composables/visibleSongs'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { useUi } from '@/stores/ui'
import AppMenu from './ui/AppMenu.vue'
import AddToListMenu from './AddToListMenu.vue'
import ListChooser from './ListChooser.vue'

// All songs (D7, set lists L5): one row per song, the list chooser and a search that stay at the
// top, + for writers, an add-to-list icon per row.
const settings = useSettings()
const songbook = useSongbook()
const ui = useUi()
const { items, download, canWrite } = useMainMenu()
const query = computed({ get: () => ui.query, set: (q: string) => { ui.query = q } })
const songs = useVisibleSongs()

// No browser zoom on the list (only the song page zooms, by its font size). touch-action in the
// style below covers Chrome and Firefox; Safari on iOS needs its gesture events stopped.
useEventListener(document, 'gesturestart', e => e.preventDefault())

// Back from a song: where the list was.
onMounted(() => nextTick(() => window.scrollTo(0, ui.listScroll)))
onBeforeUnmount(() => { ui.listScroll = window.scrollY })
</script>

<template>
  <div class="list mx-auto flex min-h-dvh max-w-2xl flex-col">
    <header class="sticky top-0 z-20 flex items-center gap-1 border-b border-line bg-bg/95 px-2 py-2 backdrop-blur">
      <AppMenu :items="items" label="Menu"><EllipsisVertical :size="20" /></AppMenu>
      <ListChooser />
      <div class="relative min-w-0 flex-1">
        <Search :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input v-model="query" type="search" class="input pl-9 pr-8" placeholder="Search" aria-label="Search">
        <button v-if="query" type="button" class="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg" aria-label="Clear the search" @click="query = ''">
          <X :size="16" />
        </button>
      </div>
      <button v-if="canWrite" type="button" class="btn btn-primary btn-icon shrink-0" aria-label="New song" @click="ui.edit(songbook.create())">
        <Plus :size="20" />
      </button>
    </header>

    <ul v-if="songs.length" class="divide-y divide-line">
      <li v-for="s in songs" :key="s.slug" class="flex items-center pr-2 hover:bg-surface">
        <button type="button" class="song-row flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-2 text-left focus-visible:bg-surface focus-visible:outline-none" :data-song="s.slug" @click="ui.show(s.slug)">
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{ s.title || s.slug }}</span>
            <span v-if="s.artist" class="block truncate text-sm text-muted">{{ s.artist }}</span>
          </span>
          <span v-if="songbook.changed(s.slug)" class="text-xs text-accent" title="Changed here, not uploaded yet" aria-label="changed here">●</span>
        </button>
        <AddToListMenu :slug="s.slug" :title="s.title || s.slug" />
      </li>
    </ul>
    <p v-else-if="songbook.list.length" class="p-6 text-center text-muted">No song matches “{{ ui.query }}”.</p>
    <div v-else-if="!settings.key" class="mx-auto max-w-sm p-6 text-center" data-empty="no-key">
      <p class="mb-1 font-semibold">No key entered yet</p>
      <p class="mb-4 text-muted">The songbook needs a key: ask the songbook's admin for one and enter it in the settings. Then download the songbook.</p>
      <button type="button" class="btn btn-primary" @click="ui.settingsOpen = true"><Settings :size="16" />Enter a key</button>
    </div>
    <div v-else class="mx-auto max-w-sm p-6 text-center" data-empty="no-songs">
      <p class="mb-4 text-muted">No songs on this device yet.</p>
      <button type="button" class="btn btn-primary" @click="download"><Download :size="16" />Download songbook</button>
    </div>

  </div>
</template>

<style scoped>
.list {
  touch-action: pan-x pan-y;
}
</style>
