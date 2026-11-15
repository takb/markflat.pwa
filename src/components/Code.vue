<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { ApiError } from '@/api/client'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { useUi } from '@/stores/ui'

// The text pane. The <pre> gets its text once (and on reset); typing updates the store, so
// re-rendering never moves the caret.
const toast = useToast()
const settings = useSettings()
const songbook = useSongbook()
const ui = useUi()
const editor = ref<HTMLPreElement>()
const confirmDelete = ref(false)
const song = computed(() => (ui.selected ? songbook.songs[ui.selected] : undefined))
const initial = song.value?.content ?? ''
const changed = computed(() => (ui.selected ? songbook.changed(ui.selected) : false))
const isNew = computed(() => song.value?.etag === null)

const updateContent = (event: Event) => {
  if (ui.selected) songbook.setContent(ui.selected, (event.target as HTMLPreElement).innerText)
}
const reset = () => {
  if (!ui.selected) return
  songbook.reset(ui.selected)
  if (editor.value && song.value) editor.value.innerText = song.value.content
}
const save = async () => {
  if (!ui.selected) return
  try {
    const r = await songbook.save(ui.selected)
    ui.selected = r.slug
    if (r.status === 'saved') {
      toast.add({ severity: 'success', summary: 'Saved', detail: (song.value?.title || r.slug) + ' is on the server.', life: 3000 })
    } else if (r.status === 'local') {
      toast.add({
        severity: 'warn',
        summary: 'Saved on this device only',
        detail: settings.key ? 'The server could not be reached; upload later from the menu.' : 'No key is set: enter your write key in the settings.',
        life: 5000,
      })
    }
  } catch (e) {
    const detail = e instanceof ApiError
      ? (e.status === 403 ? 'Your key can only read.' : e.status === 401 ? 'The key was not accepted.' : e.message)
      : String(e)
    toast.add({ severity: 'error', summary: 'Not saved', detail, life: 5000 })
  }
}
const deleteSong = async () => {
  confirmDelete.value = false
  if (!ui.selected) return
  const title = song.value?.title || ui.selected
  try {
    await songbook.remove(ui.selected)
    ui.home()
    toast.add({ severity: 'success', summary: 'Deleted', detail: title + ' was deleted. The server keeps a copy.', life: 4000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Not deleted', detail: e instanceof ApiError ? e.message : String(e), life: 5000 })
  }
}
const keyListener = (e: KeyboardEvent) => {
  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    save()
  }
}
</script>

<template>
  <div class="flex justify-between w-full p-2">
    <span class="text-lg font-bold flex-grow">
      {{ song?.title || ui.selected }}<span v-if="changed" title="Changed, not on the server yet"> *</span>
      <span v-if="isNew" class="text-sm font-normal"> (new)</span>
    </span>
    <Button type="button" icon="pi pi-home" class="mr-2" aria-label="Back to the list" @click="ui.home()" />
    <Button type="button" icon="pi pi-replay" class="mr-2" aria-label="Undo changes" :disabled="!changed || isNew" @click="reset" />
    <Button type="button" icon="pi pi-save" class="mr-2" aria-label="Save" @click="save" />
    <Button type="button" icon="pi pi-trash" class="mr-2" aria-label="Delete" @click="confirmDelete = true" />
  </div>
  <pre ref="editor" class="w-full p-2 border-0" contenteditable="true" @input="updateContent" @keydown="keyListener">{{ initial }}</pre>
  <Dialog v-model:visible="confirmDelete" modal header="Delete this song?" :style="{ width: '24rem' }">
    <p class="mb-4">{{ song?.title || ui.selected }} will be deleted{{ isNew ? '' : ' here and on the server (which keeps a copy)' }}.</p>
    <div class="flex justify-end gap-2">
      <Button label="Cancel" severity="secondary" @click="confirmDelete = false" />
      <Button label="Delete" severity="danger" @click="deleteSong" />
    </div>
  </Dialog>
</template>

<style scoped>
[contenteditable]:focus {
  outline: 0px solid transparent;
}

.tabpanel .w-full {
  width: 94vw !important;
}
</style>
