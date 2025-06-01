<script setup lang="ts">
    import { defineProps } from 'vue';
    import Tabs from 'primevue/tabs';
    import TabList from 'primevue/tablist';
    import Tab from 'primevue/tab';
    import TabPanels from 'primevue/tabpanels';
    import TabPanel from 'primevue/tabpanel';
    import Splitter from 'primevue/splitter';
    import SplitterPanel from 'primevue/splitterpanel';
    import useResponsive from '../composables/responsive';
    const sizes = useResponsive();
    const props = defineProps({
        songbook:Array,
        selected:Number
    })
</script>

<template>
    <Tabs value="0" v-if="sizes.isMobile.value">
        <TabList>
            <Tab value="0">Editor</Tab>
            <Tab value="1">Preview</Tab>
        </TabList>
        <TabPanels>
            <TabPanel value="0">
                <p class="m-0">
                    Editor {{ selected }} 
                </p>
            </TabPanel>
            <TabPanel value="1">
                <p class="m-0">
                    Preview
                </p>
            </TabPanel>
        </TabPanels>
    </Tabs>
    <Splitter style="height: 300px" v-else>
    <SplitterPanel>
        <p class="m-0">
            Editor {{ selected }}
        </p>
    </SplitterPanel>
    <SplitterPanel>
        <p class="m-0">
            Preview
        </p>
    </SplitterPanel>
</Splitter>

</template>
