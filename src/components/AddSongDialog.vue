<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Search } from '@lucide/vue'
import { compareBy, matches } from '@/lib/search'
import { useSetlists } from '@/stores/setlists'
import { useSongbook } from '@/stores/songbook'
import AppDialog from './ui/AppDialog.vue'

// Picks songs for a set list (L6a): a tap adds the song at the end and the dialog stays open for
// more; with `replacing`, a tap puts the song in that (missing) entry's place and closes it.
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ listId: string, replacing?: string | null }>()
const sets = useSetlists()
const songbook = useSongbook()
const query = ref('')
const added = ref<string[]>([])

watch(open, o => {
  if (o) {
    query.value = ''
    added.value = []
  }
})

const songs = computed(() => songbook.list.filter(s => matches(s, query.value)).sort(compareBy('title')))

function pick(slug: string) {
  if (props.replacing) {
    sets.replace(props.listId, props.replacing, slug)
    open.value = false
    return
  }
  sets.add(props.listId, slug)
  added.value = [...added.value, slug]
}
</script>

<template>
  <AppDialog v-model:open="open" :title="replacing ? 'Replace with…' : 'Add songs'">
    <div class="relative mb-2">
      <Search :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input v-model="query" type="search" class="input pl-9" placeholder="Search title, artist, text" aria-label="Search songs">
    </div>
    <ul class="-mx-2 max-h-[50dvh] overflow-y-auto" data-testid="song-picker">
      <li v-for="s in songs" :key="s.slug">
        <button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-surface" :data-pick="s.slug" @click="pick(s.slug)">
          <span class="min-w-0 flex-1">
            <span class="block truncate">{{ s.title || s.slug }}</span>
            <span v-if="s.artist" class="block truncate text-sm text-muted">{{ s.artist }}</span>
          </span>
          <span v-if="added.includes(s.slug)" class="flex items-center gap-1 text-sm text-accent">
            <Check :size="16" />{{ added.filter(a => a === s.slug).length > 1 ? '×' + added.filter(a => a === s.slug).length : '' }}
          </span>
        </button>
      </li>
      <li v-if="!songs.length" class="px-2 py-4 text-center text-muted">No song matches.</li>
    </ul>
    <template v-if="!replacing" #actions>
      <span class="mr-auto self-center text-sm text-muted">{{ added.length ? added.length + ' added' : 'Tap a song to add it' }}</span>
      <button type="button" class="btn btn-primary" @click="open = false">Done</button>
    </template>
  </AppDialog>
</template>
