<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { useSongbook } from '@/stores/songbook'
import { ApiError } from '@/api/client'

// A song changed here and on the server: show both versions, keep one (S10).
const songbook = useSongbook()
const toast = useToast()
const busy = ref(false)
const conflict = computed(() => songbook.conflicts[0] ?? null)
const visible = computed({ get: () => conflict.value !== null, set: () => {} })

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
  <Dialog v-model:visible="visible" modal :closable="false" header="This song changed on the server too" :style="{ width: 'min(60rem, 95vw)' }">
    <template v-if="conflict">
      <p class="mb-3">
        <b>{{ conflict.slug }}</b> was changed here and, in the meantime,
        {{ conflict.theirs ? 'on the server' : 'deleted on the server' }}. Which version should stay?
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <div class="font-semibold mb-1">This device</div>
          <pre class="conflict-text">{{ conflict.mine }}</pre>
        </div>
        <div>
          <div class="font-semibold mb-1">Server</div>
          <pre class="conflict-text">{{ conflict.theirs?.content ?? '(deleted)' }}</pre>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <Button label="Keep the server's" severity="secondary" :disabled="busy" @click="keep('theirs')" />
        <Button label="Keep this device's" :disabled="busy" @click="keep('mine')" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.conflict-text {
  max-height: 50vh;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 0.85em;
  padding: 0.5em;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
}
</style>
