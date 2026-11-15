<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowLeft } from '@lucide/vue'
import { ApiError, type DeletedSong } from '@/api/client'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'

// Songs deleted on the server that still have a history: open one to restore it (D6).
const settings = useSettings()
const toast = useToast()
const ui = useUi()
const songs = ref<DeletedSong[] | null>(null)
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })

onMounted(async () => {
  try {
    songs.value = (await settings.api.deleted()).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  } catch (e) {
    songs.value = []
    toast.add({ severity: 'error', summary: 'Could not load the deleted songs', detail: e instanceof ApiError ? e.message : String(e), life: 5000 })
  }
})
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-2xl">
    <header class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/95 px-2 py-2 backdrop-blur">
      <button type="button" class="btn btn-ghost btn-icon" aria-label="Back" @click="ui.back()"><ArrowLeft :size="20" /></button>
      <h1 class="flex-1 font-semibold">Deleted songs</h1>
    </header>
    <p v-if="songs === null" class="p-6 text-center text-muted">Loading…</p>
    <p v-else-if="!songs.length" class="p-6 text-center text-muted">No deleted songs.</p>
    <ul v-else class="divide-y divide-line">
      <li v-for="s in songs" :key="s.slug">
        <button type="button" class="block w-full px-4 py-2.5 text-left hover:bg-surface" @click="ui.history(s.slug)">
          <span class="block font-medium">{{ s.title || s.slug }}</span>
          <span class="block text-sm text-muted">{{ s.artist ? s.artist + ' · ' : '' }}deleted {{ when(s.deletedAt) }} by {{ s.deletedBy }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
