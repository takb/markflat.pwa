<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowLeft, Copy, Plus } from '@lucide/vue'
import { ApiError, type KeyList, type Writer } from '@/api/client'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'
import AppDialog from './ui/AppDialog.vue'

// Key management (D14), for the admin only: the server refuses everyone else anyway.
const toast = useToast()
const settings = useSettings()
const ui = useUi()
const keys = ref<KeyList | null>(null)
const newName = ref('')
const creating = ref(false)
const revoking = ref<Writer | null>(null)
const replacingRead = ref(false)
const shown = ref<{ title: string, key: string, note: string } | null>(null)

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '–')
const fail = (summary: string, e: unknown) =>
  toast.add({ severity: 'error', summary, detail: e instanceof ApiError ? e.message : String(e), life: 5000 })

async function load() {
  try {
    keys.value = await settings.api.keys()
  } catch (e) {
    fail('Could not load the keys', e)
  }
}

async function create() {
  try {
    const r = await settings.api.createKey(newName.value.trim())
    creating.value = false
    newName.value = ''
    shown.value = { title: 'Write key for ' + r.name, key: r.key, note: 'Give it to ' + r.name + '. It is shown only now; the server keeps only a fingerprint.' }
    await load()
  } catch (e) {
    fail('Key not created', e)
  }
}

async function revoke() {
  const w = revoking.value
  revoking.value = null
  if (!w) return
  try {
    await settings.api.revokeKey(w.name)
    toast.add({ severity: 'success', summary: 'Revoked', detail: w.name + '\'s key no longer works.', life: 4000 })
    await load()
  } catch (e) {
    fail('Not revoked', e)
  }
}

async function replaceRead() {
  replacingRead.value = false
  try {
    const r = await settings.api.newReadKey()
    shown.value = { title: 'New read key', key: r.key, note: 'The old read key stopped working. Give this one to everyone who reads the songbook. It is shown only now.' }
    await load()
  } catch (e) {
    fail('Read key not replaced', e)
  }
}

async function copy() {
  if (!shown.value) return
  try {
    await navigator.clipboard.writeText(shown.value.key)
    toast.add({ severity: 'success', summary: 'Copied', life: 2000 })
  } catch {
    toast.add({ severity: 'warn', summary: 'Copy it by hand', detail: 'The browser did not allow copying.', life: 3000 })
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-3xl">
    <header class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/95 px-2 py-2 backdrop-blur">
      <button type="button" class="btn btn-ghost btn-icon" aria-label="Back" @click="ui.back()"><ArrowLeft :size="20" /></button>
      <h1 class="flex-1 font-semibold">Keys</h1>
      <button type="button" class="btn btn-primary" @click="creating = true"><Plus :size="16" />New write key</button>
    </header>

    <h2 class="px-4 pt-4 pb-1 text-sm font-semibold text-muted">Write keys</h2>
    <ul class="divide-y divide-line">
      <li v-for="w in keys?.writers ?? []" :key="w.name" class="flex items-center gap-3 px-4 py-2.5" :data-writer="w.name">
        <div class="min-w-0 flex-1">
          <div class="font-medium">
            {{ w.name }}<span v-if="w.bootstrap" class="text-sm font-normal text-muted"> · server configuration</span>
          </div>
          <div class="text-sm text-muted">
            <template v-if="!w.bootstrap">Made {{ date(w.created) }} by {{ w.by }} · </template>last used {{ date(w.lastUsed) }}
          </div>
        </div>
        <button v-if="!w.bootstrap" type="button" class="btn btn-ghost text-danger" @click="revoking = w">Revoke</button>
      </li>
    </ul>

    <h2 class="px-4 pt-6 pb-1 text-sm font-semibold text-muted">Read key</h2>
    <div class="flex items-center gap-3 px-4 py-2.5">
      <div class="flex-1 text-sm">
        {{ keys?.readKey.fromSecret ? 'From the server configuration' : 'Made ' + date(keys?.readKey.created ?? null) + ' by ' + keys?.readKey.by }}
      </div>
      <button type="button" class="btn btn-secondary" @click="replacingRead = true">New read key</button>
    </div>

    <AppDialog v-model:open="creating" title="New write key">
      <label for="writerName" class="mb-1 block text-sm font-semibold">Name</label>
      <input id="writerName" v-model="newName" class="input" autocomplete="off" placeholder="e.g. kim" @keydown.enter="create">
      <p class="mt-2 text-sm text-muted">Lowercase letters, digits, _ and -. Each change this key makes is recorded under this name.</p>
      <template #actions>
        <button type="button" class="btn btn-secondary" @click="creating = false">Cancel</button>
        <button type="button" class="btn btn-primary" :disabled="!newName.trim()" @click="create">Create</button>
      </template>
    </AppDialog>

    <AppDialog :open="revoking !== null" title="Revoke this key?" @update:open="v => { if (!v) revoking = null }">
      <p>{{ revoking?.name }}'s key will stop working at once. Their past changes stay recorded.</p>
      <template #actions>
        <button type="button" class="btn btn-secondary" @click="revoking = null">Cancel</button>
        <button type="button" class="btn btn-danger" @click="revoke">Revoke</button>
      </template>
    </AppDialog>

    <AppDialog v-model:open="replacingRead" title="Replace the read key?">
      <p>The current read key stops working at once: everyone who only reads needs the new one. Write keys are not affected.</p>
      <template #actions>
        <button type="button" class="btn btn-secondary" @click="replacingRead = false">Cancel</button>
        <button type="button" class="btn btn-danger" @click="replaceRead">Replace</button>
      </template>
    </AppDialog>

    <AppDialog :open="shown !== null" :title="shown?.title ?? ''" :closable="false">
      <p class="mb-3">{{ shown?.note }}</p>
      <div class="flex gap-2">
        <input :value="shown?.key" readonly class="input font-mono" data-testid="new-key" @focus="($event.target as HTMLInputElement).select()">
        <button type="button" class="btn btn-secondary btn-icon shrink-0" aria-label="Copy" @click="copy"><Copy :size="16" /></button>
      </div>
      <template #actions>
        <button type="button" class="btn btn-primary" @click="shown = null">Done</button>
      </template>
    </AppDialog>
  </div>
</template>
