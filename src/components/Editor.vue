<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle, TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { ArrowLeft, History, RotateCcw, Save, Trash2 } from '@lucide/vue'
import { detectKey, frontMatter, parseKey, withKeyField } from 'markdown-it-markflat'
import { ApiError } from '@/api/client'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'
import AppDialog from './ui/AppDialog.vue'
import CodeEditor from './CodeEditor.vue'
import SongSheet from './SongSheet.vue'

// Editing a song: text and preview side by side on wide screens, as tabs on narrow ones.
const settings = useSettings()
const songbook = useSongbook()
const toast = useToast()
const ui = useUi()
const wide = useMediaQuery('(min-width: 900px)')
const tab = ref('text')
const confirmDelete = ref(false)
// While a save renames the song, it is briefly under neither name: keep showing the last one,
// so the editor (and its undo history) stays.
const current = computed(() => (ui.selected ? songbook.songs[ui.selected] : undefined))
const last = shallowRef(current.value)
watch(current, s => { if (s) last.value = s })
const song = computed(() => current.value ?? last.value)
const changed = computed(() => (ui.selected ? songbook.changed(ui.selected) : false))
const isNew = computed(() => song.value?.etag === null)
const content = computed({
  get: () => song.value?.content ?? '',
  set: (text: string) => { if (ui.selected) songbook.setContent(ui.selected, text) },
})

const reset = () => { if (ui.selected) songbook.reset(ui.selected) }

// The song's key goes into its front matter on save, worked out from the chords, unless it is
// there already: then it is the writer's, and only checked.
function addKey() {
  const stated = frontMatter(content.value)?.fields.key
  if (stated === undefined) {
    const key = detectKey(content.value)
    if (key) content.value = withKeyField(content.value, key)
  } else if (!parseKey(stated)) {
    toast.add({ severity: 'warn', summary: 'Key not understood', detail: '“' + stated + '” is no key (write e.g. G, Em, Bb or F#m). Transposing works the key out from the chords meanwhile.', life: 6000 })
  }
}

async function save() {
  if (!ui.selected) return
  addKey()
  try {
    const r = await songbook.save(ui.selected)
    if (r.slug !== ui.selected) ui.renamed(r.slug)
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

async function deleteSong() {
  confirmDelete.value = false
  if (!ui.selected) return
  const title = song.value?.title || ui.selected
  // a song the server never had is simply gone: no copy to mention
  const wasNew = isNew.value
  try {
    await songbook.remove(ui.selected)
    ui.home()
    toast.add({ severity: 'success', summary: 'Deleted', detail: title + ' was deleted.' + (wasNew ? '' : ' The server keeps a copy.'), life: 4000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Not deleted', detail: e instanceof ApiError ? e.message : String(e), life: 5000 })
  }
}
</script>

<template>
  <div v-if="song" class="flex h-dvh flex-col">
    <header class="flex items-center gap-1 border-b border-line px-2 py-2">
      <button type="button" class="btn btn-ghost btn-icon" aria-label="Back" @click="ui.back()"><ArrowLeft :size="20" /></button>
      <h1 class="min-w-0 flex-1 truncate px-1 font-semibold">
        {{ song.title || ui.selected }}<span v-if="changed" class="text-accent" title="Changed, not on the server yet"> ●</span>
        <span v-if="isNew" class="text-sm font-normal text-muted"> (new)</span>
      </h1>
      <button type="button" class="btn btn-ghost btn-icon" aria-label="Undo all changes" title="Undo all changes" :disabled="!changed || isNew" @click="reset"><RotateCcw :size="18" /></button>
      <button v-if="!isNew" type="button" class="btn btn-ghost btn-icon" aria-label="History" title="History" @click="ui.selected && ui.history(ui.selected)"><History :size="18" /></button>
      <button type="button" class="btn btn-ghost btn-icon" aria-label="Delete" title="Delete" @click="confirmDelete = true"><Trash2 :size="18" /></button>
      <button type="button" class="btn btn-primary" aria-label="Save" @click="save"><Save :size="16" /><span class="hidden sm:inline">Save</span></button>
    </header>

    <SplitterGroup v-if="wide" direction="horizontal" class="min-h-0 flex-1" auto-save-id="markflat-editor">
      <SplitterPanel :default-size="50" :min-size="25" class="min-h-0">
        <CodeEditor v-model="content" :font-size="settings.zoom" @save="save" />
      </SplitterPanel>
      <SplitterResizeHandle class="w-1.5 bg-surface transition-colors hover:bg-accent/40 data-[state=drag]:bg-accent/60" />
      <SplitterPanel :default-size="50" :min-size="25" class="min-h-0 overflow-y-auto px-3 py-3">
        <SongSheet :content="content" />
      </SplitterPanel>
    </SplitterGroup>

    <TabsRoot v-else v-model="tab" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="flex border-b border-line px-2" aria-label="Text or preview">
        <TabsTrigger value="text" class="tab">Text</TabsTrigger>
        <TabsTrigger value="preview" class="tab">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="text" class="min-h-0 flex-1" :force-mount="true" :hidden="tab !== 'text'">
        <CodeEditor v-model="content" :font-size="settings.zoom" @save="save" />
      </TabsContent>
      <TabsContent value="preview" class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <SongSheet :content="content" />
      </TabsContent>
    </TabsRoot>

    <AppDialog v-model:open="confirmDelete" title="Delete this song?">
      <p>{{ song.title || ui.selected }} will be deleted{{ isNew ? '' : ' here and on the server (which keeps a copy)' }}.</p>
      <template #actions>
        <button type="button" class="btn btn-secondary" @click="confirmDelete = false">Cancel</button>
        <button type="button" class="btn btn-danger" @click="deleteSong">Delete</button>
      </template>
    </AppDialog>
  </div>
  <div v-else class="mx-auto max-w-md p-6 text-center">
    <p class="mb-4 text-muted">This song is not in the songbook on this device.</p>
    <button type="button" class="btn btn-secondary" @click="ui.home()">To the list</button>
  </div>
</template>

<style scoped>
.tab {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab[data-state='active'] {
  color: var(--text);
  border-bottom-color: var(--accent);
}
</style>
