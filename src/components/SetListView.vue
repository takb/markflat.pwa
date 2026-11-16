<script setup lang="ts">
import { computed, ref } from 'vue'
import { insertNodeAt, removeNode, useSortable } from '@vueuse/integrations/useSortable'
import { Copy, Ellipsis, EllipsisVertical, GripVertical, Pencil, Plus, Replace, Trash2, X } from '@lucide/vue'
import { useMainMenu } from '@/composables/mainMenu'
import { useSetlists, type SetEntry, type SetList } from '@/stores/setlists'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'
import AppDialog from './ui/AppDialog.vue'
import AppMenu, { type MenuEntry } from './ui/AppMenu.vue'
import NameDialog from './ui/NameDialog.vue'
import AddSongDialog from './AddSongDialog.vue'
import ListChooser from './ListChooser.vue'

// A set list's own page (page 0 of the player, L5–L8, L10): its titles in order, drag and drop to
// reorder, remove, replace a missing song, add songs; a tap on a title plays from there.
const props = defineProps<{ list: SetList }>()
const emit = defineEmits<{ play: [page: number] }>()
const sets = useSetlists()
const toast = useToast()
const ui = useUi()
const { items: mainItems } = useMainMenu()
const ul = ref<HTMLElement>()
const adding = ref(false)
const replacing = ref<string | null>(null)
const renaming = ref(false)
const deleting = ref(false)

const entries = computed(() => props.list.entries)
const missing = (e: SetEntry) => sets.isMissing(e)

// The page a title plays on: its place among the songs that are there (missing ones are skipped).
const pages = computed(() => {
  const map: Record<string, number> = {}
  let n = 0
  for (const e of entries.value) if (!missing(e)) map[e.id] = ++n
  return map
})

useSortable(ul, entries, {
  handle: '.handle',
  draggable: '[data-entry]',
  animation: 150,
  watchElement: true,
  // Sortable has moved the row in the DOM already: put it back and let the store reorder, so Vue
  // stays in charge of the DOM.
  onUpdate: e => {
    if (e.oldIndex === undefined || e.newIndex === undefined) return
    removeNode(e.item)
    insertNodeAt(e.from, e.item, e.oldIndex)
    sets.move(props.list.id, e.oldIndex, e.newIndex)
  },
})

function openAdd(entry?: SetEntry) {
  replacing.value = entry?.id ?? null
  adding.value = true
}

const sign = (n: number) => (n > 0 ? '+' : '') + n

function duplicate() {
  const id = sets.duplicate(props.list.id)
  if (!id) return
  toast.add({ severity: 'success', summary: 'Duplicated', detail: 'Now showing “' + sets.get(id)?.name + '”.', life: 3000 })
  ui.openSet(id)
}

function remove() {
  const name = props.list.name
  deleting.value = false
  sets.remove(props.list.id)
  ui.home()
  toast.add({ severity: 'success', summary: 'Deleted', detail: '“' + name + '” was deleted.', life: 3000 })
}

const listItems = computed<MenuEntry[]>(() => [
  { label: 'Rename', icon: Pencil, action: () => { renaming.value = true } },
  { label: 'Duplicate', icon: Copy, action: duplicate },
  { label: 'Delete', icon: Trash2, separatorBefore: true, action: () => { deleting.value = true } },
])
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-2xl flex-col">
    <header class="sticky top-0 z-20 flex items-center gap-1 border-b border-line bg-bg/95 px-2 py-2 backdrop-blur">
      <AppMenu :items="mainItems" label="Menu"><EllipsisVertical :size="20" /></AppMenu>
      <ListChooser />
      <span class="flex-1" />
      <AppMenu :items="listItems" label="List actions" align="end"><Ellipsis :size="20" /></AppMenu>
    </header>

    <ul v-if="entries.length" ref="ul" class="divide-y divide-line" data-testid="set-entries">
      <li v-for="e in entries" :key="e.id" class="flex items-center gap-1 pr-2" data-entry :data-slug="e.slug" :data-missing="missing(e) || undefined">
        <span class="handle flex h-11 w-9 shrink-0 cursor-grab items-center justify-center text-muted" aria-label="Drag to reorder" title="Drag to reorder"><GripVertical :size="18" /></span>
        <span class="w-6 shrink-0 text-right text-sm text-muted tabular-nums">{{ pages[e.id] ?? '–' }}</span>
        <button v-if="!missing(e)" type="button" class="min-w-0 flex-1 truncate px-2 py-2.5 text-left font-medium hover:text-accent" @click="emit('play', pages[e.id])">{{ e.title }}</button>
        <span v-else class="min-w-0 flex-1 truncate px-2 py-2.5 text-muted italic">missing: {{ e.title }}</span>
        <button v-if="e.transpose && !missing(e)" type="button" class="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent tabular-nums" :aria-label="'Transposed by ' + e.transpose + ', tap to reset'" @click="sets.setTranspose(list.id, e.id, 0)">{{ sign(e.transpose) }}</button>
        <button v-if="missing(e)" type="button" class="btn btn-secondary h-8 shrink-0" @click="openAdd(e)"><Replace :size="16" />Replace</button>
        <button type="button" class="btn btn-ghost btn-icon shrink-0 text-muted" aria-label="Remove from the list" @click="sets.removeEntry(list.id, e.id)"><X :size="18" /></button>
      </li>
    </ul>
    <p v-else class="px-6 pt-8 pb-2 text-center text-muted">This list is empty.</p>

    <div class="p-4 text-center">
      <button type="button" class="btn btn-secondary" @click="openAdd()"><Plus :size="16" />Add song</button>
    </div>
    <p v-if="Object.keys(pages).length" class="px-4 pb-24 text-center text-sm text-muted">Tap a title, or swipe left, to play.</p>

    <AddSongDialog v-model:open="adding" :list-id="list.id" :replacing="replacing" />
    <NameDialog v-model:open="renaming" title="Rename the list" :initial="list.name" confirm="Rename" @done="name => sets.rename(list.id, name)" />
    <AppDialog v-model:open="deleting" title="Delete this list?">
      <p>“{{ list.name }}” will be deleted from this device. The songs stay in the songbook.</p>
      <template #actions>
        <button type="button" class="btn btn-secondary" @click="deleting = false">Cancel</button>
        <button type="button" class="btn btn-danger" @click="remove">Delete</button>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.handle {
  touch-action: none;
}
</style>
