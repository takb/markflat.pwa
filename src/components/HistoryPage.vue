<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, ChevronDown, ChevronRight } from '@lucide/vue'
import { ApiError, type RevisionInfo } from '@/api/client'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'
import AppDialog from './ui/AppDialog.vue'
import SongSheet from './SongSheet.vue'

// A song's older versions (D6), newest first; a writer can make one current again. Also for
// deleted songs (from "Deleted songs"), which then come back.
const settings = useSettings()
const songbook = useSongbook()
const toast = useToast()
const ui = useUi()
const slug = ui.selected ?? ''
const revisions = ref<RevisionInfo[] | null>(null)
const open = ref<string | null>(null)
const contents = ref<Record<string, string>>({})
const restoring = ref<RevisionInfo | null>(null)
const local = computed(() => songbook.songs[slug])
const title = computed(() => local.value?.title || slug)

const verbs = { save: 'saved', delete: 'deleted it', rename: 'renamed it', restore: 'restored an older version' }
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const fail = (summary: string, e: unknown) =>
  toast.add({ severity: 'error', summary, detail: e instanceof ApiError ? e.message : String(e), life: 5000 })

onMounted(async () => {
  try {
    revisions.value = await settings.api.revisions(slug)
  } catch (e) {
    revisions.value = []
    fail('Could not load the history', e)
  }
})

async function toggle(r: RevisionInfo) {
  open.value = open.value === r.id ? null : r.id
  if (open.value && contents.value[r.id] === undefined) {
    try {
      contents.value[r.id] = (await settings.api.revision(slug, r.id)).content
    } catch (e) {
      fail('Could not load this version', e)
    }
  }
}

async function restore() {
  const r = restoring.value
  restoring.value = null
  if (!r) return
  const existed = local.value !== undefined
  try {
    await songbook.restore(slug, r.id)
    toast.add({ severity: 'success', summary: 'Restored', detail: 'The version from ' + when(r.time) + ' is current again.', life: 4000 })
    if (existed) ui.back()
    else ui.replace('show', slug)
  } catch (e) {
    fail('Not restored', e)
  }
}
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-3xl">
    <header class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/95 px-2 py-2 backdrop-blur">
      <button type="button" class="btn btn-ghost btn-icon" aria-label="Back" @click="ui.back()"><ArrowLeft :size="20" /></button>
      <h1 class="min-w-0 flex-1 truncate font-semibold">History: {{ title }}</h1>
    </header>

    <p v-if="revisions === null" class="p-6 text-center text-muted">Loading…</p>
    <p v-else-if="!revisions.length" class="p-6 text-center text-muted">No older versions of this song.</p>
    <ul v-else class="divide-y divide-line">
      <li v-for="r in revisions" :key="r.id">
        <button type="button" class="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-surface" :aria-expanded="open === r.id" @click="toggle(r)">
          <component :is="open === r.id ? ChevronDown : ChevronRight" :size="16" class="shrink-0 text-muted" />
          <span class="flex-1">
            <span class="block font-medium">{{ when(r.time) }}</span>
            <span class="block text-sm text-muted">The version before {{ r.writer }} {{ verbs[r.action] }}</span>
          </span>
        </button>
        <div v-if="open === r.id" class="border-t border-line bg-surface/50 px-4 py-3">
          <p v-if="contents[r.id] === undefined" class="text-muted">Loading…</p>
          <template v-else>
            <div class="mb-3 flex justify-end">
              <button v-if="settings.me?.canWrite" type="button" class="btn btn-primary" @click="restoring = r">Restore this version</button>
            </div>
            <SongSheet :content="contents[r.id]" />
          </template>
        </div>
      </li>
    </ul>

    <AppDialog :open="restoring !== null" title="Restore this version?" @update:open="o => { if (!o) restoring = null }">
      <p>
        {{ title }} goes back to the version from {{ restoring && when(restoring.time) }}.
        The current version stays in the history.
        <b v-if="local && songbook.changed(slug)">Your changes on this device that are not uploaded are replaced.</b>
      </p>
      <template #actions>
        <button type="button" class="btn btn-secondary" @click="restoring = null">Cancel</button>
        <button type="button" class="btn btn-primary" @click="restore">Restore</button>
      </template>
    </AppDialog>
  </div>
</template>
