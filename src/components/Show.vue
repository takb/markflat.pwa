<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import showdown from "../composables/markflat";
import store from "../composables/store.ts";
import SpeedDial from 'primevue/speeddial';
import {computed, ref} from "vue";

const model = defineModel({type: String, default: ''})
const md = new showdown.Converter({extensions: ['markflat']});
const trigger = ref(0);
const html = computed(() => {
  trigger.value++
  return md.makeHtml(model.value)
})
const zoom = computed(() => {
  return {'zoom': store.zoom};
});

const transposeUp = () => {
  let val = md.getOption('mbTransposeBy')
  val++;
  if (val > 11) {
    val = 0
  }
  md.setOption('mbTransposeBy', val)
  trigger.value++
}
const transposeDown = () => {
  let val = md.getOption('mbTransposeBy')
  val--
  if (val < -11) {
    val = 0
  }
  md.setOption('mbTransposeBy', val)
  trigger.value++
}
const toggleDetailedChordView = () => {
  const current = md.getOption('mbDetailedChordView')
  md.setOption('mbDetailedChordView', !current)
  trigger.value++
}
const toggleUseUnicodeAccidentals = () => {
  const current = md.getOption('useUnicodeAccidentals')
  md.setOption('useUnicodeAccidentals', !current)
  trigger.value++
}
const swipe = (direction: any) => {
  if (direction === 'left') {
    zoomOut()
  } else if (direction === 'right') {
    zoomIn()
  }
}
const longtap = () => {
  store.view = 'list'
}
const zoomIn = () => {
  store.zoom = Math.min(2, store.zoom + 0.1);
}
const zoomOut = () => {
  store.zoom = Math.max(0.5, store.zoom - 0.1);
}
const zoomReset = () => {
  store.zoom = 1;
}
const items : MenuItem[] = [
  {
    label: 'Zoom in',
    icon: 'pi pi-search-plus',
    command: zoomIn
  },
  {
    label: 'Reset zoom',
    icon: 'pi pi-search',
    command: zoomReset
  },
  {
    label: 'Zoom out',
    icon: 'pi pi-search-minus',
    command: zoomOut
  },
  {
    label: 'Transpose up',
    icon: 'pi pi-caret-up',
    command: transposeUp
  },
  {
    label: 'Transpose down',
    icon: 'pi pi-caret-down',
    command: transposeDown
  },
  {
    label: 'Toggle detailed chord view',
    icon: 'pi pi-sparkles',
    command: toggleDetailedChordView
  },
  {
    label: 'Toggle use Unicode accidentals',
    icon: 'pi pi-hashtag',
    command: toggleUseUnicodeAccidentals
  },
  {
    label: 'Return to list',
    icon: 'pi pi-home',
    command: () => {
      store.view = 'list'
    }
  }
]
</script>

<template>
  <SpeedDial :model="items" direction="left" :style="{ position: 'absolute', right: '2em', bottom: '2em' }"
             :buttonProps="{ severity: 'help', rounded: true }" :tooltipOptions="{ event: 'hover', position: 'top' }"/>
  <div v-html="html" class="h-full w-full p-2 mb" :style="zoom" v-touch:longtap="longtap" v-touch:swipe="swipe"></div>
</template>
