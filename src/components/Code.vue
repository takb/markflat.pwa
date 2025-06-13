<script setup lang="ts">
import { ref } from 'vue'

const model = defineModel({type: String, default: ''})
const content = ref(model.value)
const updateContent = (event: Event) => {
    const target = event.target as HTMLPreElement;
    model.value = target.innerText
}
</script>

<template>
    <pre class="h-full w-full" contenteditable="true" @input="updateContent">{{ content }}</pre>
</template>

<style scoped>

</style>