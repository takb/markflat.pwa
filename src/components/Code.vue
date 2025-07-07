<script setup lang="ts">
import {computed, ref} from 'vue'
import {useToast} from 'primevue/usetoast';
import Button from 'primevue/button'
import store from '../composables/store'

const model = defineModel({type: String, default: ''})
const toast = useToast();
const content = ref(model.value)
const editor = ref()
const updateContent = (event: Event) => {
  const target = event.target as HTMLPreElement;
  model.value = target.innerText
  store.setContent(target.innerText)
}
const home = () => {
  if (content.value.trim() !== store.selected?.content.trim()) {
    console.warn("Content has changed, but not saved. Returning to list view.");
  }
  store.view = 'list'
}
const reset = () => {
  if (store.selected) {
    model.value = store.selected.content;
    editor.value.innerText = store.selected.content;
  }
}
const save = () => {
  if (!changed)
    return
  if (!store.apiKeyWrite) {
    toast.add({severity: 'warn', summary: 'Deleting locally', detail: 'No API key configured with write access.', life: 3000})
  }
  store.saveSong()
  fetch('https://www.genkidelic.de/songbook.php', {
      method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: "key=" + encodeURIComponent(store.apiKeyWrite) 
          + "&store=" + encodeURIComponent(filename.value) 
          + "&content=" + encodeURIComponent(model.value)
    })
    .then(async response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const result = await response.json()
      console.log(result)
      toast.add({
        severity: result.status,
        summary: result.title,
        detail: result.message,
        life: 3000
      })
    })
    .catch(err => {
      console.error(err)
      toast.add({severity: 'error', summary: 'Saving failed', detail: 'Could not save song file ' + filename.value + '.', life: 3000})
    })
}
const deleteSong = () => {
  if (changed.value) {
    toast.add({severity: 'error', summary: 'Delete failed', detail: 'To delete a song click the button without changing the file content.', life: 3000})
    return
  }
  if (!store.apiKeyWrite) {
    toast.add({severity: 'warn', summary: 'Deleting locally', detail: 'No API key configured with write access.', life: 3000})
  }
  store.deleteSong()
  fetch('https://www.genkidelic.de/songbook.php', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: "key=" + encodeURIComponent(store.apiKeyWrite) 
        + "&delete=" + encodeURIComponent(filename.value)
    })
    .then(() => {
      toast.add({
        severity: 'success',
        summary: 'Delete completed',
        detail: 'Successfully deleted ' + filename.value + '.',
        life: 3000
      })
    })
    .catch(err => {
      console.error(err)
      toast.add({severity: 'error', summary: 'Delete failed', detail: 'Could not delete song.', life: 3000})
    })
}
const filename = computed(() => {
  const matched = model.value.match(/^# (.+?) -/);
  return matched ? matched[1].replace(/\(.*\)/g, '').trim().toLowerCase().replace(/\s+/g, '_').replace(/\W+/g, '') + '.mb' : "newfile.md"
})
const changed = computed(() => {
  return model.value !== store.selected?.content;
})
const keyListener = (e: KeyboardEvent) => {
  if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      save()
      e.preventDefault()
  }
}
</script>

<template>
  <div class="flex justify-between w-full p-2">
    <span class="text-lg font-bold flex-grow">{{ filename }} {{ changed ? '*' : '' }}</span>
    <Button type="button" icon="pi pi-home" @click="home" class="mr-2"/>
    <Button type="button" icon="pi pi-replay" @click="reset" class="mr-2"/>
    <Button type="button" icon="pi pi-save" @click="save" class="mr-2"/>
    <Button type="button" icon="pi pi-trash" @click="deleteSong" class="mr-2"/>
  </div>
  <pre ref="editor" class="w-full p-2 border-0" contenteditable="true" @input="updateContent" @keydown="keyListener">{{ content }}</pre>
</template>

<style scoped>
[contenteditable]:focus {
  outline: 0px solid transparent;
}

.tabpanel .w-full {
  width: 94vw !important;
}
</style>