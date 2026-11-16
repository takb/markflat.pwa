<script setup lang="ts">
import { computed, ref } from 'vue'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui'
import { Check, ChevronDown, ListMusic, Music, Plus } from '@lucide/vue'
import { useSetlists } from '@/stores/setlists'
import { useUi } from '@/stores/ui'
import NameDialog from './ui/NameDialog.vue'

// The header's list chooser (L5): all songs, or one of the set lists, or a new list.
const sets = useSetlists()
const ui = useUi()
const naming = ref(false)
const current = computed(() => (ui.view === 'set' ? sets.get(ui.selected) : undefined))

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const songs = (n: number) => n + (n === 1 ? ' song' : ' songs')

function create(name: string) {
  ui.openSet(sets.create(name))
}
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger class="btn btn-ghost min-w-0 max-w-[45vw] shrink justify-start px-2 sm:max-w-64" aria-label="Choose a list" data-testid="list-chooser">
      <component :is="current ? ListMusic : Music" :size="18" class="shrink-0 text-muted" />
      <span class="truncate">{{ current?.name ?? 'All songs' }}</span>
      <ChevronDown :size="16" class="shrink-0 text-muted" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="menu max-h-[70dvh] max-w-[90vw] overflow-y-auto" align="start" :side-offset="6" :collision-padding="8">
        <DropdownMenuItem class="menu-item" @select="ui.home()">
          <Music :size="16" class="text-muted" />
          <span class="flex-1">All songs</span>
          <Check v-if="!current" :size="16" class="text-accent" />
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="sets.lists.length" class="my-1 h-px bg-line" />
        <DropdownMenuItem v-for="l in sets.lists" :key="l.id" class="menu-item items-start" :data-list="l.name" @select="ui.openSet(l.id)">
          <ListMusic :size="16" class="mt-0.5 text-muted" />
          <span class="min-w-0 flex-1">
            <span class="block truncate">{{ l.name }}</span>
            <span class="block text-xs text-muted">{{ songs(l.entries.length) }} · changed {{ when(l.changed) }}</span>
          </span>
          <Check v-if="current?.id === l.id" :size="16" class="mt-0.5 text-accent" />
        </DropdownMenuItem>
        <DropdownMenuSeparator class="my-1 h-px bg-line" />
        <DropdownMenuItem class="menu-item" @select="naming = true">
          <Plus :size="16" class="text-muted" />
          <span class="flex-1">Add new list…</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
  <NameDialog v-model:open="naming" title="New set list" confirm="Create" @done="create" />
</template>
