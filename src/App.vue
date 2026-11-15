<script setup lang="ts">
import Toast from 'primevue/toast'
import PWABadge from '@/components/PWABadge.vue'
import Editor from '@/components/Editor.vue'
import List from '@/components/List.vue'
import Show from '@/components/Show.vue'
import Keys from '@/components/Keys.vue'
import ConflictDialog from '@/components/ConflictDialog.vue'
import { useSongbook } from '@/stores/songbook'
import { useUi } from '@/stores/ui'

const songbook = useSongbook()
const ui = useUi()
</script>

<template>
  <Toast />
  <Editor v-if="ui.selected && songbook.songs[ui.selected] && ui.view === 'edit'" :key="ui.selected" />
  <Show v-else-if="ui.selected && songbook.songs[ui.selected] && ui.view === 'show'" :model-value="songbook.songs[ui.selected].content" />
  <Keys v-else-if="ui.view === 'keys'" />
  <List v-else class="h-full w-full" />
  <ConflictDialog />
  <PWABadge />
</template>
