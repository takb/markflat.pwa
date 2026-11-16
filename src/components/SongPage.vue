<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useVisibleSongs } from '@/composables/visibleSongs'
import { useSongbook } from '@/stores/songbook'
import { useUi } from '@/stores/ui'
import SongPager from './SongPager.vue'

// A song opened from "All songs" (L9): swiping sideways goes through the list as shown (its
// order and, if active, the search's matches); turning a page replaces the history step, so back
// returns to the list. Transposing here is not remembered.
const songbook = useSongbook()
const ui = useUi()
const visible = useVisibleSongs()
const transposes = reactive<Record<string, number>>({})

const slugs = computed(() => {
  const list = visible.value.map(s => s.slug)
  if (!ui.selected) return []
  return list.includes(ui.selected) ? list : [ui.selected]
})
const items = computed(() => slugs.value.map(slug => ({ key: slug, slug, transpose: transposes[slug] ?? 0 })))
const index = computed(() => Math.max(0, slugs.value.indexOf(ui.selected ?? '')))

const turn = (n: number) => { if (slugs.value[n]) ui.showInstead(slugs.value[n]) }
const transpose = (i: number, value: number) => { transposes[slugs.value[i]] = value }
</script>

<template>
  <SongPager v-if="ui.selected && songbook.songs[ui.selected]" :items="items" :index="index" @update:index="turn" @transpose="transpose" @back="ui.back()" />
  <div v-else class="mx-auto max-w-md p-6 text-center">
    <p class="mb-4 text-muted">This song is not in the songbook on this device.</p>
    <button type="button" class="btn btn-secondary" @click="ui.home()">To the list</button>
  </div>
</template>
