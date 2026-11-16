<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import PWABadge from '@/components/PWABadge.vue'
import List from '@/components/List.vue'
import SongPage from '@/components/SongPage.vue'
import SetPlayer from '@/components/SetPlayer.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import Keys from '@/components/Keys.vue'
import HistoryPage from '@/components/HistoryPage.vue'
import DeletedPage from '@/components/DeletedPage.vue'
import ConflictDialog from '@/components/ConflictDialog.vue'
import Toasts from '@/components/ui/Toasts.vue'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'

// The editor (CodeMirror) loads only when a song is edited: readers never need it.
const Editor = defineAsyncComponent(() => import('@/components/Editor.vue'))
const settings = useSettings()
const ui = useUi()

// Who the key belongs to (for the menus); quietly, the app works offline too.
if (settings.key) settings.checkKey().catch(() => {})
</script>

<template>
  <Editor v-if="ui.view === 'edit' && ui.selected" />
  <SongPage v-else-if="ui.view === 'show' && ui.selected" />
  <SetPlayer v-else-if="ui.view === 'set' && ui.selected" :key="ui.selected" />
  <HistoryPage v-else-if="ui.view === 'history' && ui.selected" :key="ui.selected" />
  <DeletedPage v-else-if="ui.view === 'deleted'" />
  <Keys v-else-if="ui.view === 'keys'" />
  <List v-else />
  <ConflictDialog />
  <SettingsDialog v-model:open="ui.settingsOpen" />
  <Toasts />
  <PWABadge />
</template>
