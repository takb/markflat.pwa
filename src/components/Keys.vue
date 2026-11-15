<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { ApiError, type KeyList, type Writer } from '@/api/client'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'

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

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '–')
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
  <div class="keys p-4 max-w-4xl mx-auto">
    <div class="flex items-center gap-2 mb-4">
      <Button icon="pi pi-home" aria-label="Back to the list" @click="ui.home()" />
      <h1 class="text-xl font-bold flex-grow">Keys</h1>
      <Button label="New write key" icon="pi pi-plus" @click="creating = true" />
    </div>

    <DataTable :value="keys?.writers ?? []" data-key="name" striped-rows>
      <Column field="name" header="Writer">
        <template #body="{ data }">
          {{ data.name }}
          <span v-if="data.bootstrap" class="text-sm opacity-70"> (server configuration)</span>
        </template>
      </Column>
      <Column header="Created">
        <template #body="{ data }">{{ data.bootstrap ? '–' : date(data.created) + ' by ' + data.by }}</template>
      </Column>
      <Column header="Last used">
        <template #body="{ data }">{{ date(data.lastUsed) }}</template>
      </Column>
      <Column>
        <template #body="{ data }">
          <Button v-if="!data.bootstrap" label="Revoke" severity="danger" text @click="revoking = data" />
        </template>
      </Column>
    </DataTable>

    <div class="mt-8 flex items-center gap-4">
      <div class="flex-grow">
        <div class="font-semibold">Read key</div>
        <div class="text-sm opacity-80">
          {{ keys?.readKey.fromSecret ? 'From the server configuration' : 'Made ' + date(keys?.readKey.created ?? null) + ' by ' + keys?.readKey.by }}
        </div>
      </div>
      <Button label="New read key" severity="secondary" @click="replacingRead = true" />
    </div>

    <Dialog v-model:visible="creating" modal header="New write key" :style="{ width: '24rem' }">
      <label for="writerName" class="font-semibold block mb-2">Name</label>
      <InputText id="writerName" v-model="newName" class="w-full" autocomplete="off" placeholder="e.g. kim" @keydown.enter="create" />
      <p class="text-sm mt-2 mb-4">Lowercase letters, digits, _ and -. Each change this key makes is recorded under this name.</p>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" severity="secondary" @click="creating = false" />
        <Button label="Create" :disabled="!newName.trim()" @click="create" />
      </div>
    </Dialog>

    <Dialog :visible="revoking !== null" modal header="Revoke this key?" :style="{ width: '24rem' }" @update:visible="v => { if (!v) revoking = null }">
      <p class="mb-4">{{ revoking?.name }}'s key will stop working at once. Their past changes stay recorded.</p>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" severity="secondary" @click="revoking = null" />
        <Button label="Revoke" severity="danger" @click="revoke" />
      </div>
    </Dialog>

    <Dialog v-model:visible="replacingRead" modal header="Replace the read key?" :style="{ width: '26rem' }">
      <p class="mb-4">The current read key stops working at once: everyone who only reads needs the new one. Write keys are not affected.</p>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" severity="secondary" @click="replacingRead = false" />
        <Button label="Replace" severity="danger" @click="replaceRead" />
      </div>
    </Dialog>

    <Dialog :visible="shown !== null" modal :closable="false" :header="shown?.title" :style="{ width: '28rem' }">
      <p class="mb-3">{{ shown?.note }}</p>
      <div class="flex gap-2 mb-4">
        <InputText :model-value="shown?.key" readonly class="flex-auto font-mono" data-testid="new-key" @focus="($event.target as HTMLInputElement).select()" />
        <Button icon="pi pi-copy" aria-label="Copy" @click="copy" />
      </div>
      <div class="flex justify-end">
        <Button label="Done" @click="shown = null" />
      </div>
    </Dialog>
  </div>
</template>
