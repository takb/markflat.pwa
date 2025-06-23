<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button'
import store from '../composables/store'

const model = defineModel({type: String, default: ''})
const toast = useToast();
const content = ref(model.value)
const editor = ref()
const updateContent = (event: Event) => {
    const target = event.target as HTMLPreElement;
    model.value = target.innerText
}
const home = (event: Event) => {
    if (content.value.trim() !== store.selected?.content.trim()) {
        console.warn("Content has changed, but not saved. Returning to list view.");
    }
    store.view = 'list'
}
const reset = (event: Event) => {
    if (store.selected) {
        model.value = store.selected.content;
        editor.value.innerText = store.selected.content;
    }
}
const save = (event: Event) => {
}
const deleteSong = (event: any) => {
    fetch('https://www.genkidelic.de/songbook.php?delete=' + filename.value + '&key=' + store.apiKey)
        .then(res => {
            toast.add({ severity: 'success', summary: 'Delete completed', detail: 'Successfully deleted ' + filename.value + '.', life: 3000 })
            store.deleteSong(event.data.id)
        })
        .catch(err => {
            console.error(err)
            toast.add({ severity: 'error', summary: 'Delete failed', detail: 'Could not delete song.', life: 3000 })
        })
}
const filename = computed(() => {
    const matched = model.value.match(/^# (.+?) -/);
    return matched ? matched[1].replace(/\(.*\)/g, '').trim().toLowerCase().replace(/\s+/g, '_').replace(/\'/g, '') + '.mb' : "newfile.md"
})
const changed = computed(() => {
    return model.value !== store.selected?.content;
})
</script>

<template>
    <div class="flex justify-between w-full p-2">
        <span class="text-lg font-bold flex-grow">{{ filename }} {{ changed ? '*' : '' }}</span>
        <Button type="button" icon="pi pi-home" @click="home" class="mr-2" />
        <Button type="button" icon="pi pi-replay" @click="reset" class="mr-2" />
        <Button type="button" icon="pi pi-save" @click="save" class="mr-2" />
        <Button type="button" icon="pi pi-trash" @click="deleteSong" class="mr-2" />
    </div>
    <pre ref="editor" class="w-full p-2 border-0" contenteditable="true" @input="updateContent">{{ content }}</pre>
</template>

<style scoped>
[contenteditable]:focus {
    outline: 0px solid transparent;
}
.tabpanel .w-full {
    width: 94vw !important;
}
</style>