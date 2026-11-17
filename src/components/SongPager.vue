<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ToolbarButton, ToolbarRoot, ToolbarSeparator } from 'reka-ui'
import { AArrowDown, AArrowUp, ArrowLeft, ChevronLeft, ChevronRight, Ellipsis, History, Minus, Pencil, Plus, RefreshCw } from '@lucide/vue'
import { isChartRow, songKey, transposeKey } from 'markdown-it-markflat'
import { useAutoHide, useSongGestures } from '@/composables/gestures'
import { useMainMenu } from '@/composables/mainMenu'
import { useRemote } from '@/stores/remote'
import { tapZone } from '@/lib/gestures'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { useUi } from '@/stores/ui'
import AppMenu, { type MenuEntry } from './ui/AppMenu.vue'
import SongSheet from './SongSheet.vue'

// Songs as pages you swipe through (set lists L8, L9): the song list as shown, or a set list
// with the list itself as the first page (the `first` slot). Sideways is the browser's own
// scroll-snap; two fingers pinch (font size) or swipe up/down (transpose); taps on the outer
// tenth turn the page, with an arrow that appears and fades; a toolbar at the bottom hides
// while scrolling down.

export interface PagerItem {
  key: string
  slug: string
  transpose: number
}

const props = withDefaults(defineProps<{
  items: PagerItem[]
  index: number
  /** a set list: its name in the toolbar, and the `first` slot as page 0 */
  listName?: string
}>(), { listName: undefined })
const emit = defineEmits<{
  'update:index': [index: number]
  transpose: [item: number, value: number]
  back: []
}>()

const settings = useSettings()
const songbook = useSongbook()
const ui = useUi()
const remote = useRemote()
const { download } = useMainMenu()
const offset = computed(() => (props.listName === undefined ? 0 : 1))
const count = computed(() => props.items.length + offset.value)
const track = ref<HTMLElement>()
const pages = new Map<number, HTMLElement>()
const shown = ref(props.index)
const current = computed(() => props.items[shown.value - offset.value])
const scroller = ref<HTMLElement>()
const { visible, toggle } = useAutoHide(scroller)
const arrow = ref<{ side: 'previous' | 'next', n: number } | null>(null)
const flash = ref(0)
const pinchZoom = ref<number | null>(null)

const pageRef = (n: number) => (el: unknown) => {
  if (el instanceof HTMLElement) pages.set(n, el)
  else pages.delete(n)
}
const near = (n: number) => Math.abs(n - shown.value) <= 1
const song = (slug: string) => songbook.songs[slug]

// ---- which page is shown: the scroll position and the index (the route) kept in step

function scrollTo(n: number, smooth = false) {
  const el = track.value
  if (el) el.scrollTo({ left: n * el.clientWidth, behavior: smooth ? 'smooth' : 'instant' })
}

let settleTimer = 0
function settle() {
  clearTimeout(settleTimer)
  const el = track.value
  if (!el || !el.clientWidth) return
  const n = Math.max(0, Math.min(count.value - 1, Math.round(el.scrollLeft / el.clientWidth)))
  if (n !== shown.value) {
    shown.value = n
    emit('update:index', n)
  }
  scroller.value = pages.get(n)
}
const onScroll = () => {
  clearTimeout(settleTimer)
  settleTimer = window.setTimeout(settle, 150)
}
useEventListener(track, 'scrollend', settle)
useEventListener(window, 'resize', () => scrollTo(shown.value))

onMounted(async () => {
  await nextTick()
  scrollTo(props.index)
  scroller.value = pages.get(props.index)
})
watch(() => props.index, n => {
  if (n === shown.value) return
  shown.value = n
  scrollTo(n)
  nextTick(() => { scroller.value = pages.get(n) })
})

function turn(side: 'previous' | 'next') {
  const n = shown.value + (side === 'next' ? 1 : -1)
  if (n < 0 || n >= count.value) return
  arrow.value = { side, n: (arrow.value?.n ?? 0) + 1 }
  scrollTo(n, true)
}

// ---- transposing (one octave each way; a full octave is the original key again)

const transpose = computed(() => current.value?.transpose ?? 0)
function transposeBy(steps: number) {
  if (!current.value) return
  let t = transpose.value + steps
  if (t > 11 || t < -11) t = 0
  emit('transpose', shown.value - offset.value, t)
  flash.value++
}
const resetTranspose = () => {
  if (current.value && transpose.value) emit('transpose', shown.value - offset.value, 0)
}
const transposeLabel = computed(() => (transpose.value > 0 ? '+' : '') + transpose.value)
// the key it is played in while transposed (the song's key: its `key:` field or its chords)
const playedKey = computed(() => {
  const content = current.value && transpose.value ? song(current.value.slug)?.content : undefined
  const key = content ? songKey(content) : null
  const to = key ? transposeKey(key, transpose.value) : null
  return to && settings.unicode ? to.replace('#', '♯').replace(/(?<=^[A-G])b/, '♭') : to
})
const zoomBy = (n: number) => settings.setZoom(settings.zoom + n)

useSongGestures(track, {
  pinch(scale, phase) {
    if (!current.value) return
    if (phase === 'start') pinchZoom.value = settings.zoom
    else if (phase === 'move' && pinchZoom.value !== null) settings.setZoom(pinchZoom.value * scale)
    else pinchZoom.value = null
  },
  transpose: steps => transposeBy(steps),
  tap(e) {
    if (!current.value) return
    const zone = tapZone(e.clientX, window.innerWidth)
    if (zone === 'middle') toggle()
    else turn(zone)
  },
})

// Arrow keys turn the page on a computer (not while typing or in a dialog).
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const t = e.target as HTMLElement
  if (t.closest('input, textarea, [contenteditable], [role="dialog"], [role="menu"]')) return
  e.preventDefault()
  turn(e.key === 'ArrowRight' ? 'next' : 'previous')
})

// Safari on iOS: its own pinch zoom would fight ours.
useEventListener(document, 'gesturestart', e => e.preventDefault())

// the chart switch only for a song that has a chart
const hasChart = computed(() => !!current.value && (song(current.value.slug)?.content ?? '').split('\n').some(isChartRow))

const more = computed<MenuEntry[]>(() => [
  // songs changed elsewhere: here only a dot on ⋯ and this entry (RemoteNotice stays away while playing)
  { label: 'Sync (' + remote.count + ' changed)', icon: RefreshCw, hidden: !remote.count, action: () => { download() } },
  { label: 'Chords as written', checked: settings.chords === 'plain', separatorBefore: remote.count > 0, action: () => { settings.chords = 'plain' } },
  { label: 'Detailed chords', checked: settings.chords === 'detailed', action: () => { settings.chords = 'detailed' } },
  { label: 'Jazz chords', checked: settings.chords === 'jazz', action: () => { settings.chords = 'jazz' } },
  { label: 'Show ♯ and ♭', checked: settings.unicode, separatorBefore: true, action: () => { settings.unicode = !settings.unicode } },
  { label: 'Center chords in chart bars', checked: settings.centered, hidden: !hasChart.value, action: () => { settings.centered = !settings.centered } },
  { label: 'Reset zoom', action: () => settings.setZoom(1) },
  { label: 'Edit song', icon: Pencil, hidden: props.listName === undefined || !settings.me?.canWrite, separatorBefore: true, action: () => current.value && ui.edit(current.value.slug) },
  { label: 'History', icon: History, hidden: !settings.key || !current.value || song(current.value.slug)?.etag === null, separatorBefore: props.listName === undefined, action: () => current.value && ui.history(current.value.slug) },
])
</script>

<template>
  <div class="relative">
    <div ref="track" class="track flex h-dvh snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain" data-testid="pager" @scroll.passive="onScroll">
      <section v-if="listName !== undefined" :ref="pageRef(0)" class="page" data-page="0" :data-current="shown === 0 || undefined">
        <slot name="first" />
      </section>
      <section v-for="(item, i) in items" :key="item.key" :ref="pageRef(i + offset)" class="page" :data-page="i + offset" :data-slug="item.slug" :data-current="shown === i + offset || undefined">
        <div v-if="near(i + offset) && song(item.slug)" class="mx-auto max-w-4xl px-3 pt-3 pb-24">
          <SongSheet :content="song(item.slug)!.content" :transpose="item.transpose" />
        </div>
      </section>
    </div>

    <Transition name="arrow">
      <div v-if="arrow" :key="arrow.n" class="pointer-events-none fixed top-1/2 z-40 -translate-y-1/2 rounded-full bg-fg/70 p-2 text-bg" :class="arrow.side === 'next' ? 'right-3' : 'left-3'" aria-hidden="true" data-testid="page-arrow" :data-side="arrow.side" @animationend="arrow = null">
        <component :is="arrow.side === 'next' ? ChevronRight : ChevronLeft" :size="32" />
      </div>
    </Transition>

    <ToolbarRoot
      v-if="current"
      class="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-4xl items-center gap-1 border-t border-line bg-bg/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 sm:rounded-t-xl sm:border-x"
      :class="visible ? 'translate-y-0' : 'translate-y-full'"
      aria-label="Song"
      :data-visible="visible"
    >
      <ToolbarButton class="btn btn-ghost btn-icon shrink-0" aria-label="Back" @click="listName === undefined ? emit('back') : emit('update:index', 0)"><ArrowLeft :size="20" /></ToolbarButton>
      <ToolbarButton v-if="listName !== undefined" class="my-1 flex min-w-0 flex-1 flex-col items-start rounded-md bg-accent px-2 py-0.5 text-left leading-tight text-accent-fg hover:bg-accent-strong" aria-label="To the set list" data-testid="toolbar-list" @click="emit('update:index', 0)">
        <span class="w-full truncate text-sm font-medium">{{ listName }}</span>
        <span class="text-xs tabular-nums opacity-80">{{ shown }}/{{ items.length }}</span>
      </ToolbarButton>
      <ToolbarSeparator v-else class="mx-1 h-6 w-px bg-line" />
      <ToolbarButton class="btn btn-ghost btn-icon shrink-0" aria-label="Transpose down" @click="transposeBy(-1)"><Minus :size="18" /></ToolbarButton>
      <button
        :key="flash"
        type="button"
        class="min-w-9 shrink-0 rounded px-1 text-center text-sm font-semibold whitespace-nowrap tabular-nums"
        :class="[transpose ? 'text-accent' : 'text-muted', flash ? 'flash' : '']"
        :aria-label="'Transposed by ' + transpose + (playedKey ? ', to ' + playedKey : '') + (transpose ? ', tap to reset' : '')"
        data-testid="transpose-value"
        @click="resetTranspose"
      >{{ transposeLabel }}<span v-if="playedKey" class="font-normal"> · {{ playedKey }}</span></button>
      <ToolbarButton class="btn btn-ghost btn-icon shrink-0" aria-label="Transpose up" @click="transposeBy(1)"><Plus :size="18" /></ToolbarButton>
      <ToolbarSeparator class="mx-1 h-6 w-px shrink-0 bg-line" />
      <ToolbarButton class="btn btn-ghost btn-icon shrink-0" aria-label="Smaller" @click="zoomBy(-0.1)"><AArrowDown :size="20" /></ToolbarButton>
      <ToolbarButton class="btn btn-ghost btn-icon shrink-0" aria-label="Larger" @click="zoomBy(0.1)"><AArrowUp :size="20" /></ToolbarButton>
      <span v-if="listName === undefined" class="flex-1" />
      <ToolbarButton v-if="listName === undefined && settings.me?.canWrite" class="btn btn-ghost btn-icon shrink-0" aria-label="Edit" @click="current && ui.edit(current.slug)"><Pencil :size="18" /></ToolbarButton>
      <AppMenu :items="more" :label="remote.visible ? 'More (songs changed on the server)' : 'More'" side="top" align="end">
        <span class="relative">
          <Ellipsis :size="20" />
          <span v-if="remote.visible" class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent" data-testid="remote-dot" />
        </span>
      </AppMenu>
    </ToolbarRoot>
  </div>
</template>

<style scoped>
.track {
  scrollbar-width: none;
}
.track::-webkit-scrollbar {
  display: none;
}
.page {
  flex: 0 0 100%;
  height: 100dvh;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  touch-action: pan-x pan-y;
}
.arrow-enter-active {
  animation: arrow 600ms ease-out forwards;
}
@keyframes arrow {
  0% { opacity: 0; }
  20% { opacity: 1; }
  100% { opacity: 0; }
}
.flash {
  animation: flash 500ms ease-out;
}
@keyframes flash {
  0% { background: var(--accent-soft); transform: scale(1.25); }
  100% { background: transparent; transform: scale(1); }
}
</style>
