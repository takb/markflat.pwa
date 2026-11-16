<script setup lang="ts">
import { ref, watch } from 'vue'
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { Monitor, Moon, Sun } from '@lucide/vue'
import { ApiError } from '@/api/client'
import { useSettings, type Theme } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import AppDialog from './ui/AppDialog.vue'

const open = defineModel<boolean>('open', { required: true })
const settings = useSettings()
const toast = useToast()
const keyInput = ref('')
const keyStatus = ref('')

const describe = () => {
  const me = settings.me
  if (!me) return ''
  if (me.isAdmin) return 'Writes as ' + me.writer + ' (admin)'
  if (me.writer) return 'Writes as ' + me.writer
  return me.name && me.name !== 'shared' ? 'Reads as ' + me.name : 'Reads (the shared read key)'
}

watch(open, o => {
  if (!o) return
  keyInput.value = settings.key
  keyStatus.value = describe()
})

async function saveKey() {
  if (keyInput.value.trim() === settings.key && settings.me) {
    open.value = false
    return
  }
  settings.setKey(keyInput.value)
  try {
    await settings.checkKey()
    keyStatus.value = describe()
    toast.add({ severity: 'success', summary: 'Key saved', detail: keyStatus.value + '.', life: 3000 })
    open.value = false
  } catch (e) {
    keyStatus.value = e instanceof ApiError && e.status === 401 ? 'This key is not valid.' : 'Could not check the key (offline?). It is saved.'
  }
}

const themes: { value: Theme, label: string, icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]
const setTheme = (v: unknown) => { if (v) settings.theme = v as Theme }
</script>

<template>
  <AppDialog v-model:open="open" title="Settings">
    <label for="apiKey" class="mb-1 block text-sm font-semibold">Key</label>
    <input id="apiKey" v-model="keyInput" type="password" class="input" autocomplete="off" @keydown.enter="saveKey">
    <p class="mt-1 min-h-5 text-sm text-muted">{{ keyStatus || 'Your read or write key, from the songbook\'s admin.' }}</p>

    <div class="mt-4 mb-1 text-sm font-semibold">Colours</div>
    <ToggleGroupRoot :model-value="settings.theme" type="single" class="inline-flex rounded-lg bg-surface p-1" aria-label="Colours" @update:model-value="setTheme">
      <ToggleGroupItem
        v-for="t in themes"
        :key="t.value"
        :value="t.value"
        class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted data-[state=on]:bg-bg data-[state=on]:text-fg data-[state=on]:shadow-sm"
      >
        <component :is="t.icon" :size="16" />{{ t.label }}
      </ToggleGroupItem>
    </ToggleGroupRoot>

    <template #actions>
      <button type="button" class="btn btn-secondary" @click="open = false">Cancel</button>
      <button type="button" class="btn btn-primary" @click="saveKey">Save</button>
    </template>
  </AppDialog>
</template>
