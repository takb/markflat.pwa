import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { createApi, type Me } from '@/api/client'
import { storage } from '@/lib/storage'

// The key (one field: a write key also reads), who it belongs to, and the zoom.
export const useSettings = defineStore('settings', () => {
  const key = ref(storage.get('markflat.key') ?? '')
  const me = ref<Me | null>(null)
  const zoom = ref(Number(storage.get('markflat.zoom')) || 1)
  const api = createApi(() => key.value)

  watch(zoom, z => storage.set('markflat.zoom', String(z)))

  function setKey(value: string) {
    key.value = value.trim()
    storage.set('markflat.key', key.value)
    me.value = null
  }

  /** Asks the server whose key it is; throws ApiError (401 for a wrong key, 0 offline). */
  async function checkKey(): Promise<Me> {
    me.value = await api.me()
    return me.value
  }

  return { key, me, zoom, api, setKey, checkKey }
})
