<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui'
import { ListMusic, ListPlus, Plus } from '@lucide/vue'
import { useSetlists } from '@/stores/setlists'
import { useToast } from '@/stores/toast'
import NameDialog from './ui/NameDialog.vue'

// "Add to a set list" on a row of All songs (L6b): the lists, or a new one. Mounted only for the
// row whose icon was tapped (List.vue): one menu and dialog per row made All songs slow to open.
const props = defineProps<{ slug: string, title: string }>()
const open = defineModel<boolean>('open', { default: false })
const sets = useSetlists()
const toast = useToast()
const naming = ref(false)
const trigger = ref<{ $el: HTMLElement }>()

// It replaces the plain icon that was tapped: take over its focus, so it comes back here on close.
onMounted(() => trigger.value?.$el.focus())

function add(id: string) {
  sets.add(id, props.slug)
  toast.add({ severity: 'success', summary: 'Added', detail: props.title + ' → ' + sets.get(id)?.name, life: 2500 })
}
const create = (name: string) => add(sets.create(name))
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal="false">
    <DropdownMenuTrigger ref="trigger" class="btn btn-ghost btn-icon shrink-0 text-muted" :aria-label="'Add ' + title + ' to a set list'">
      <ListPlus :size="18" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="menu max-h-[60dvh] max-w-[80vw] overflow-y-auto" align="end" :side-offset="4" :collision-padding="8">
        <DropdownMenuLabel class="px-2.5 py-1.5 text-xs text-muted">Add to set list</DropdownMenuLabel>
        <DropdownMenuItem v-for="l in sets.lists" :key="l.id" class="menu-item" @select="add(l.id)">
          <ListMusic :size="16" class="text-muted" />
          <span class="min-w-0 flex-1 truncate">{{ l.name }}</span>
          <span class="text-xs text-muted tabular-nums">{{ l.entries.length }}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="sets.lists.length" class="my-1 h-px bg-line" />
        <DropdownMenuItem class="menu-item" @select="naming = true">
          <Plus :size="16" class="text-muted" />
          <span class="flex-1">New list…</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
  <NameDialog v-model:open="naming" title="New set list" confirm="Create and add" @done="create" />
</template>
