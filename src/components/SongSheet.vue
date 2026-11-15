<script setup lang="ts">
import { computed } from 'vue'
import { md } from '@/composables/markdown'
import { useSettings } from '@/stores/settings'

// A rendered song. The zoom is the font size: the song is laid out again, never magnified.
const props = withDefaults(defineProps<{ content: string, transpose?: number, zoom?: number }>(), { transpose: 0, zoom: undefined })
const settings = useSettings()
const html = computed(() => md.render(props.content, {
  transpose: props.transpose, detailed: settings.detailed, unicode: settings.unicode,
}))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- markdown-it with html: false escapes the song text -->
  <div class="mb" :style="{ fontSize: (zoom ?? settings.zoom) + 'rem' }" v-html="html" />
</template>
