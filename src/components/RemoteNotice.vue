<script setup lang="ts">
import { computed, ref } from 'vue'
import { RefreshCw, X } from '@lucide/vue'
import { useMainMenu } from '@/composables/mainMenu'
import { useRemote } from '@/stores/remote'
import { useUi } from '@/stores/ui'

// "Songs changed on the server", with Sync (the songbook download: edits made here are kept,
// a song changed on both sides goes to the conflict dialog). While a song plays it stays out
// of the way: a dot on the toolbar's ⋯ and an entry in its menu instead (SongPager).
const remote = useRemote()
const ui = useUi()
const { download } = useMainMenu()
const syncing = ref(false)
const playing = computed(() => ui.view === 'show' || (ui.view === 'set' && ui.page > 0))

async function sync() {
  syncing.value = true
  try {
    await download()
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <Transition name="notice">
    <div
      v-if="remote.visible && !playing"
      role="status"
      class="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-line bg-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg"
      data-testid="remote-notice"
    >
      <RefreshCw :size="20" class="shrink-0 text-accent" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">Changed on the server</p>
        <p class="text-sm text-muted">{{ remote.summary }}</p>
      </div>
      <button type="button" class="btn btn-primary h-8 shrink-0" :disabled="syncing" @click="sync">Sync</button>
      <button type="button" class="btn btn-ghost btn-icon -mr-1 h-7 w-7 shrink-0" aria-label="Not now" @click="remote.dismiss()"><X :size="16" /></button>
    </div>
  </Transition>
</template>

<style scoped>
.notice-enter-active,
.notice-leave-active {
  transition: opacity 200ms, transform 200ms;
}
.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}
</style>
