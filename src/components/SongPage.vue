<script setup lang="ts">
import { computed, ref } from 'vue'
import { ToolbarButton, ToolbarRoot, ToolbarSeparator } from 'reka-ui'
import { AArrowDown, AArrowUp, ArrowLeft, Ellipsis, History, Minus, Pencil, Plus } from '@lucide/vue'
import { useSongGestures, useAutoHide } from '@/composables/gestures'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { useUi } from '@/stores/ui'
import AppMenu, { type MenuEntry } from './ui/AppMenu.vue'
import SongSheet from './SongSheet.vue'

// The song page (D7): the song, and a slim toolbar at the bottom that hides while scrolling
// down. Pinch sets the font size; a sideways swipe transposes.
const settings = useSettings()
const songbook = useSongbook()
const ui = useUi()
const song = computed(() => (ui.selected ? songbook.songs[ui.selected] : undefined))
const transpose = ref(0)
const scroller = ref<HTMLElement>()
const sheet = ref<HTMLElement>()
const pinchZoom = ref<number | null>(null)
const { visible, toggle } = useAutoHide(scroller)

// One octave each way; a full octave is the original key again.
const transposeBy = (n: number) => {
  const t = transpose.value + n
  transpose.value = t > 11 || t < -11 ? 0 : t
}
const transposeLabel = computed(() => (transpose.value > 0 ? '+' : '') + transpose.value)
const zoomBy = (n: number) => settings.setZoom(settings.zoom + n)

useSongGestures(sheet, {
  pinch(scale, phase) {
    if (phase === 'start') pinchZoom.value = settings.zoom
    else if (phase === 'move' && pinchZoom.value !== null) settings.setZoom(pinchZoom.value * scale)
    else pinchZoom.value = null
  },
  swipe: dir => transposeBy(dir === 'right' ? 1 : -1),
  tap: toggle,
})

const more = computed<MenuEntry[]>(() => [
  { label: 'Detailed chords', checked: settings.detailed, action: () => { settings.detailed = !settings.detailed } },
  { label: 'Show ♯ and ♭', checked: settings.unicode, action: () => { settings.unicode = !settings.unicode } },
  { label: 'Reset zoom', action: () => settings.setZoom(1) },
  { label: 'History', icon: History, hidden: !settings.key || song.value?.etag === null, action: () => ui.selected && ui.history(ui.selected), separatorBefore: true },
])
</script>

<template>
  <div v-if="song" ref="scroller" class="h-dvh overflow-y-auto overscroll-contain">
    <div ref="sheet" class="song-area mx-auto max-w-4xl px-3 pt-3 pb-24">
      <SongSheet :content="song.content" :transpose="transpose" />
    </div>
    <ToolbarRoot
      class="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-4xl items-center gap-1 border-t border-line bg-bg/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 sm:rounded-t-xl sm:border-x"
      :class="visible ? 'translate-y-0' : 'translate-y-full'"
      aria-label="Song"
      :data-visible="visible"
    >
      <ToolbarButton class="btn btn-ghost btn-icon" aria-label="Back" @click="ui.back()"><ArrowLeft :size="20" /></ToolbarButton>
      <ToolbarSeparator class="mx-1 h-6 w-px bg-line" />
      <ToolbarButton class="btn btn-ghost btn-icon" aria-label="Transpose down" @click="transposeBy(-1)"><Minus :size="18" /></ToolbarButton>
      <span class="w-9 text-center text-sm font-semibold tabular-nums" :class="transpose ? 'text-accent' : 'text-muted'" aria-live="polite" :aria-label="'Transposed by ' + transpose">{{ transposeLabel }}</span>
      <ToolbarButton class="btn btn-ghost btn-icon" aria-label="Transpose up" @click="transposeBy(1)"><Plus :size="18" /></ToolbarButton>
      <ToolbarSeparator class="mx-1 h-6 w-px bg-line" />
      <ToolbarButton class="btn btn-ghost btn-icon" aria-label="Smaller" @click="zoomBy(-0.1)"><AArrowDown :size="20" /></ToolbarButton>
      <ToolbarButton class="btn btn-ghost btn-icon" aria-label="Larger" @click="zoomBy(0.1)"><AArrowUp :size="20" /></ToolbarButton>
      <span class="flex-1" />
      <ToolbarButton v-if="settings.me?.canWrite" class="btn btn-ghost btn-icon" aria-label="Edit" @click="ui.selected && ui.edit(ui.selected)"><Pencil :size="18" /></ToolbarButton>
      <AppMenu :items="more" label="More" side="top" align="end"><Ellipsis :size="20" /></AppMenu>
    </ToolbarRoot>
  </div>
  <div v-else class="mx-auto max-w-md p-6 text-center">
    <p class="mb-4 text-muted">This song is not in the songbook on this device.</p>
    <button type="button" class="btn btn-secondary" @click="ui.home()">To the list</button>
  </div>
</template>

<style scoped>
.song-area {
  touch-action: pan-y;
  min-height: 100%;
}
</style>
