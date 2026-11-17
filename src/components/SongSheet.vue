<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { md } from '@/composables/markdown'
import { useSettings } from '@/stores/settings'

// A rendered song. The zoom is the font size: the song is laid out again, never magnified.
const props = withDefaults(defineProps<{ content: string, transpose?: number, zoom?: number }>(), { transpose: 0, zoom: undefined })
const settings = useSettings()
const root = ref<HTMLElement>()
const html = computed(() => md.render(props.content, {
  transpose: props.transpose, detailed: settings.chords === 'detailed', jazz: settings.chords === 'jazz', unicode: settings.unicode,
}))

// Charts take the full width with equal bars; their chords are 1.6 × the lyrics, made smaller
// for the whole chart just as far as its widest bar needs (chord charts C7). Measured again
// whenever the song, the width or the zoom changes.
function fitCharts() {
  for (const chart of root.value?.querySelectorAll<HTMLElement>('.mb-chart') ?? []) {
    chart.style.fontSize = ''
    let ratio = 1
    for (const c of chart.querySelectorAll<HTMLElement>('.mb-cc, .mb-repeat')) {
      if (c.scrollWidth > c.clientWidth && c.clientWidth > 0) ratio = Math.min(ratio, c.clientWidth / c.scrollWidth)
    }
    if (ratio < 1) chart.style.fontSize = (1.6 * ratio * 0.97).toFixed(3) + 'em'
  }
}
watch(html, () => nextTick(fitCharts), { immediate: true })
useResizeObserver(root, fitCharts)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- markdown-it with html: false escapes the song text -->
  <div ref="root" class="mb" :style="{ fontSize: (zoom ?? settings.zoom) + 'rem' }" v-html="html" />
</template>
