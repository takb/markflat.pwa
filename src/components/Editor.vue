<script setup lang="ts">
import {ref, toRaw} from "vue";
  import Tabs from 'primevue/tabs';
  import TabList from 'primevue/tablist';
  import Tab from 'primevue/tab';
  import TabPanels from 'primevue/tabpanels';
  import TabPanel from 'primevue/tabpanel';
  import Splitter from 'primevue/splitter';
  import SplitterPanel from 'primevue/splitterpanel';
  import useSizes from '../composables/sizes.ts';
  import store from '../composables/store.ts';
  import Code from "./Code.vue";
  import Show from "./Show.vue";

  const sizes = useSizes()
  const content = ref(toRaw(store.selected)?.content)
  const panelCss = sizes.isMobile.value ? 'w-full h-full min-h-full p-2' : 'h-full w-1/2';
</script>

<template>
  <Tabs value="0" v-if="sizes.isMobile.value" class="h-full w-full">
    <TabList>
      <Tab value="0">Editor</Tab>
      <Tab value="1">Preview</Tab>
    </TabList>
    <TabPanels>
      <TabPanel value="0" :class="panelCss">
        <Code v-model="content" />
      </TabPanel>
      <TabPanel value="1">
        <Show v-model="content" />
      </TabPanel>
    </TabPanels>
  </Tabs>
  <Splitter class="h-full w-full" v-else>
    <SplitterPanel class="rounded-none">
      <Code v-model="content"/>
    </SplitterPanel>
    <SplitterPanel>
      <Show v-model="content"/>
    </SplitterPanel>
  </Splitter>
</template>

<style scoped>
.p-splitter {
  border-radius: 0;
}
</style>
