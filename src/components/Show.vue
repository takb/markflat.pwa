<script setup lang="ts">
import showdown from "../composables/markflat";
import {store} from "../composables/store.ts";
import SpeedDial from 'primevue/speeddial';
import {ref} from "vue";

const props = defineProps({
  source: {
    type: String,
    default: ""
  }
});
const convertHtml = () => {
  const md = new showdown.Converter({extensions: ['markflat']});
  return md.makeHtml(props.source);
}
const html = ref(convertHtml())
const transposeUp = (event) => {
  let val = showdown.getOption('mbTransposeBy')
  val++;
  if (val > 11) {
    val = 0;
  }
  showdown.setOption('mbTransposeBy', val)
  html.value = convertHtml();
  console.log(event)
  event.originalEvent.cancelBubble = true;
  event.preventDefault();
}
const transposeDown = (event) => {
  let val = showdown.getOption('mbTransposeBy')
  val--;
  if (val < -11) {
    val = 0;
  }
  showdown.setOption('mbTransposeBy', val)
  html.value = convertHtml();
  event.preventDefault()
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
             :buttonProps="{ severity: 'help', rounded: true }" :tooltipOptions="{ position: 'top' }"/>
  <div v-html="html" class="p-2 mb"></div>
</template>

<style>
h1 {
  font-size: 2em;
  margin-bottom: 0.5em;
}
</style>