<script setup lang="ts">
import showdown from "../composables/markflat";
import store from "../composables/store.ts";
import SpeedDial from 'primevue/speeddial';
import {computed, ref} from "vue";

const model = defineModel({type: String, default: ''})
const md = new showdown.Converter({extensions: ['markflat']});
const trigger = ref(0);
const convertHtml = () => {
  trigger.value++
  return md.makeHtml(model.value)
}
const html = computed(convertHtml)
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
const items = [
  {
    label: 'Transpose up',
    icon: 'pi pi-angle-right',
    command: transposeUp
  },
  {
    label: 'Transpose down',
    icon: 'pi pi-angle-left',
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
  <div v-html="html" class="h-full w-full p-2 mb"></div>
</template>
