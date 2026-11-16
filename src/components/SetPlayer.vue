<script setup lang="ts">
import { computed } from 'vue'
import { useSetlists } from '@/stores/setlists'
import { useUi } from '@/stores/ui'
import SetListView from './SetListView.vue'
import SongPager from './SongPager.vue'

// A set list (L8): the list itself is page 0, its songs follow in order (missing ones skipped).
// A key set while playing is remembered for that entry (L4).
const sets = useSetlists()
const ui = useUi()
const list = computed(() => sets.get(ui.selected))
const playable = computed(() => list.value?.entries.filter(e => !sets.isMissing(e)) ?? [])
const items = computed(() => playable.value.map(e => ({ key: e.id, slug: e.slug, transpose: e.transpose })))
const index = computed(() => Math.min(ui.page, items.value.length))

function transpose(i: number, value: number) {
  const entry = playable.value[i]
  if (list.value && entry) sets.setTranspose(list.value.id, entry.id, value)
}
</script>

<template>
  <SongPager v-if="list" :items="items" :index="index" :list-name="list.name" @update:index="ui.setPage" @transpose="transpose">
    <template #first>
      <SetListView :list="list" @play="ui.setPage" />
    </template>
  </SongPager>
  <div v-else class="mx-auto max-w-md p-6 text-center">
    <p class="mb-4 text-muted">This set list is not on this device.</p>
    <button type="button" class="btn btn-secondary" @click="ui.home()">To all songs</button>
  </div>
</template>
