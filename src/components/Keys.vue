<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { ArrowLeft, BookOpen, Copy, Pencil, Plus } from '@lucide/vue'
import { ApiError, type KeyInfo, type Role } from '@/api/client'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'
import AppDialog from './ui/AppDialog.vue'

// Key management (D14, named read keys since 2026-11-15), for the admin only: the server refuses
// everyone else anyway. Every key has a name and a role; all but the admin's can be revoked.
const toast = useToast()
const settings = useSettings()
const ui = useUi()
const keys = ref<KeyInfo[] | null>(null)
const creating = ref(false)
const newName = ref('')
const newRole = ref<Role>('read')
const revoking = ref<KeyInfo | null>(null)
const shown = ref<{ title: string, key: string, note: string } | null>(null)

const roles = { read: 'Reads', write: 'Writes' }
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

function openCreate() {
  newName.value = ''
  newRole.value = 'read'
  creating.value = true
}

async function create() {
  try {
    const r = await settings.api.createKey(newName.value.trim(), newRole.value)
    creating.value = false
    shown.value = {
      title: (r.role === 'write' ? 'Write key' : 'Read key') + ' for ' + r.name,
      key: r.key,
      note: 'Give it to ' + r.name + (r.role === 'write' ? ': it reads and writes, and changes are recorded under this name.' : ': it reads the songbook.')
        + ' It is shown only now; the server keeps only a fingerprint.',
    }
    await load()
  } catch (e) {
    fail('Key not created', e)
  }
}

async function revoke() {
  const k = revoking.value
  revoking.value = null
  if (!k) return
  try {
    await settings.api.revokeKey(k.name)
    toast.add({ severity: 'success', summary: 'Revoked', detail: 'The key "' + k.name + '" no longer works.', life: 4000 })
    await load()
  } catch (e) {
    fail('Not revoked', e)
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

const setRole = (v: unknown) => { if (v) newRole.value = v as Role }

onMounted(load)
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-3xl">
    <header class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/95 px-2 py-2 backdrop-blur">
      <button type="button" class="btn btn-ghost btn-icon" aria-label="Back" @click="ui.back()"><ArrowLeft :size="20" /></button>
      <h1 class="flex-1 font-semibold">Keys</h1>
      <button type="button" class="btn btn-primary" @click="openCreate"><Plus :size="16" />New key</button>
    </header>

    <p v-if="keys === null" class="p-6 text-center text-muted">Loading…</p>
    <ul v-else class="divide-y divide-line">
      <li v-for="k in keys" :key="k.name" class="flex items-center gap-3 px-4 py-2.5" :data-key-name="k.name">
        <component :is="k.role === 'write' ? Pencil : BookOpen" :size="18" class="shrink-0 text-muted" :aria-label="roles[k.role]" />
        <div class="min-w-0 flex-1">
          <div class="font-medium">
            {{ k.name }}
            <span class="ml-1 rounded bg-surface px-1.5 py-0.5 text-xs font-normal text-muted">{{ roles[k.role] }}</span>
            <span v-if="k.configured" class="text-sm font-normal text-muted"> · server configuration</span>
          </div>
          <div class="text-sm text-muted">
            <template v-if="!k.configured">Made {{ date(k.created) }} by {{ k.by }} · </template>last used {{ date(k.lastUsed) }}
          </div>
        </div>
        <button v-if="k.revocable" type="button" class="btn btn-ghost text-danger" @click="revoking = k">Revoke</button>
      </li>
    </ul>
    <p class="px-4 py-4 text-sm text-muted">
      A write key also reads. To let a reader write, make them a write key and revoke their read key.
    </p>

    <AppDialog v-model:open="creating" title="New key">
      <label for="keyName" class="mb-1 block text-sm font-semibold">Name</label>
      <input id="keyName" v-model="newName" class="input" autocomplete="off" placeholder="e.g. kim or band" @keydown.enter="create">
      <p class="mt-1 text-sm text-muted">Lowercase letters, digits, _ and -.</p>
      <div class="mt-4 mb-1 text-sm font-semibold">May</div>
      <ToggleGroupRoot :model-value="newRole" type="single" class="inline-flex rounded-lg bg-surface p-1" aria-label="Role" @update:model-value="setRole">
        <ToggleGroupItem v-for="role in (['read', 'write'] as const)" :key="role" :value="role" class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted data-[state=on]:bg-bg data-[state=on]:text-fg data-[state=on]:shadow-sm">
          <component :is="role === 'write' ? Pencil : BookOpen" :size="16" />{{ role === 'write' ? 'Read and write' : 'Read' }}
        </ToggleGroupItem>
      </ToggleGroupRoot>
      <template #actions>
        <button type="button" class="btn btn-secondary" @click="creating = false">Cancel</button>
        <button type="button" class="btn btn-primary" :disabled="!newName.trim()" @click="create">Create</button>
      </template>
    </AppDialog>

    <AppDialog :open="revoking !== null" title="Revoke this key?" @update:open="v => { if (!v) revoking = null }">
      <p v-if="revoking?.configured">
        The shared read key from the server configuration stops working at once, for everyone who still uses it,
        and stays revoked after later deploys. Give them their own keys first.
      </p>
      <p v-else>The key "{{ revoking?.name }}" stops working at once.<template v-if="revoking?.role === 'write'"> Its past changes stay recorded.</template></p>
      <template #actions>
        <button type="button" class="btn btn-secondary" @click="revoking = null">Cancel</button>
        <button type="button" class="btn btn-danger" @click="revoke">Revoke</button>
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
