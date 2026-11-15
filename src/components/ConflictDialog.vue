<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError } from '@/api/client'
import { useSongbook } from '@/stores/songbook'
import { useToast } from '@/stores/toast'
import AppDialog from './ui/AppDialog.vue'

// A song changed here and on the server: show both versions, keep one (S10).
const songbook = useSongbook()
const toast = useToast()
const busy = ref(false)
const conflict = computed(() => songbook.conflicts[0] ?? null)
const open = computed({ get: () => conflict.value !== null, set: () => {} })

async function keep(which: 'mine' | 'theirs') {
  if (!conflict.value) return
  busy.value = true
  try {
    await songbook.resolve(conflict.value.slug, which)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Not saved', detail: e instanceof ApiError ? e.message : String(e), life: 5000 })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" title="This song changed on the server too" :closable="false" wide>
    <template v-if="conflict">
      <p class="mb-3">
        <b>{{ conflict.slug }}</b> was changed here and, in the meantime,
        {{ conflict.theirs ? 'on the server' : 'deleted on the server' }}. Which version should stay?
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <div class="mb-1 text-sm font-semibold">This device</div>
          <pre class="conflict-text">{{ conflict.mine }}</pre>
        </div>
        <div>
          <div class="mb-1 text-sm font-semibold">Server</div>
          <pre class="conflict-text">{{ conflict.theirs?.content ?? '(deleted)' }}</pre>
        </div>
      </div>
    </template>
    <template #actions>
      <button type="button" class="btn btn-secondary" :disabled="busy" @click="keep('theirs')">Keep the server's</button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="keep('mine')">Keep this device's</button>
    </template>
  </AppDialog>
</template>

<style scoped>
.conflict-text {
  max-height: 45vh;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 0.8rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface);
}
</style>
