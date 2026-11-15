<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { md } from '../composables/markdown'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import SpeedDial from 'primevue/speeddial'
import {computed, ref} from 'vue'

const model = defineModel({type: String, default: ''})
const settings = useSettings()
const ui = useUi()
const transpose = ref(0)
const detailed = ref(false)
const unicode = ref(true)
const html = computed(() => md.render(model.value, {
  transpose: transpose.value, detailed: detailed.value, unicode: unicode.value,
}))
const zoom = computed(() => {
  return {'zoom': settings.zoom}
})

// One octave each way; a full octave is the original key again.
const transposeUp = () => {
  transpose.value = transpose.value >= 11 ? 0 : transpose.value + 1
}
const transposeDown = () => {
  transpose.value = transpose.value <= -11 ? 0 : transpose.value - 1
}
const toggleDetailedChordView = () => {
  detailed.value = !detailed.value
}
const toggleUseUnicodeAccidentals = () => {
  unicode.value = !unicode.value
}
const swipe = (direction: string) => {
  if (direction === 'left') {
    zoomOut()
  } else if (direction === 'right') {
    zoomIn()
  }
}
const longtap = () => {
  ui.home()
}
const zoomIn = () => {
  settings.zoom = Math.min(2, settings.zoom + 0.1)
}
const zoomOut = () => {
  settings.zoom = Math.max(0.5, settings.zoom - 0.1)
}
const zoomReset = () => {
  settings.zoom = 1
}
const items : MenuItem[] = [
  {
    label: 'Zoom in',
    icon: 'pi pi-search-plus',
    command: zoomIn,
  },
  {
    label: 'Reset zoom',
    icon: 'pi pi-search',
    command: zoomReset,
  },
  {
    label: 'Zoom out',
    icon: 'pi pi-search-minus',
    command: zoomOut,
  },
  {
    label: 'Transpose up',
    icon: 'pi pi-caret-up',
    command: transposeUp,
  },
  {
    label: 'Transpose down',
    icon: 'pi pi-caret-down',
    command: transposeDown,
  },
  {
    label: 'Toggle detailed chord view',
    icon: 'pi pi-sparkles',
    command: toggleDetailedChordView,
  },
  {
    label: 'Toggle use Unicode accidentals',
    icon: 'pi pi-hashtag',
    command: toggleUseUnicodeAccidentals,
  },
  {
    label: 'Return to list',
    icon: 'pi pi-home',
    command: () => {
      ui.home()
    },
  },
]
</script>

<template>
  <SpeedDial :model="items" direction="left" :style="{ position: 'absolute', right: '2em', bottom: '2em' }"
             :button-props="{ severity: 'help', rounded: true }" :tooltip-options="{ event: 'hover', position: 'top' }" />
  <!-- eslint-disable-next-line vue/no-v-html -- markdown-it with html: false escapes the song text -->
  <div v-touch:longtap="longtap" v-touch:swipe="swipe" class="h-full w-full p-2 mb" :style="zoom" v-html="html"></div>
</template>
