<script setup lang="ts">
import Toast from 'primevue/toast'
import PWABadge from '@/components/PWABadge.vue'
import Editor from "@/components/Editor.vue"
import List from "@/components/List.vue"
import Show from "@/components/Show.vue"
import store from './composables/store'
</script>

<template>
  <Toast />
  <Editor v-if="store.selected && store.view === 'edit'"/>
  <Show v-else-if="store.selected && store.view === 'show'" v-model="store.selected.content"/>
  <List v-else class="h-full w-full"/>
  <PWABadge/>
</template>

<style scoped>
.nobr {
  white-space: nowrap;
}
</style>