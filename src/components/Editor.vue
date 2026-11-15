<script setup lang="ts">
  import { computed } from 'vue'
  import Tabs from 'primevue/tabs'
  import TabList from 'primevue/tablist'
  import Tab from 'primevue/tab'
  import TabPanels from 'primevue/tabpanels'
  import TabPanel from 'primevue/tabpanel'
  import Splitter from 'primevue/splitter'
  import SplitterPanel from 'primevue/splitterpanel'
  import useSizes from '../composables/sizes.ts'
  import { useSongbook } from '@/stores/songbook'
  import { useUi } from '@/stores/ui'
  import Code from './Code.vue'
  import Show from './Show.vue'

  const sizes = useSizes()
  const songbook = useSongbook()
  const ui = useUi()
  const content = computed(() => (ui.selected && songbook.songs[ui.selected]?.content) || '')
  const panelCss = sizes.isMobile.value ? 'w-full h-full min-h-full p-2' : 'h-full w-1/2'
</script>

<template>
  <Tabs v-if="sizes.isMobile.value" value="0" class="h-full w-full">
    <TabList>
      <Tab value="0">Editor</Tab>
      <Tab value="1">Preview</Tab>
    </TabList>
    <TabPanels>
      <TabPanel value="0" :class="panelCss">
        <Code />
      </TabPanel>
      <TabPanel value="1">
        <Show :model-value="content" />
      </TabPanel>
    </TabPanels>
  </Tabs>
  <Splitter v-else class="h-full w-full">
    <SplitterPanel class="rounded-none">
      <Code />
    </SplitterPanel>
    <SplitterPanel>
      <Show :model-value="content" />
    </SplitterPanel>
  </Splitter>
</template>

<style scoped>
.p-splitter {
  border-radius: 0;
}
</style>
