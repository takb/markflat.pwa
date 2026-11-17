import { defineStore } from 'pinia'
import { ref, watch, watchEffect } from 'vue'
import { createApi, type Me } from '@/api/client'
import { storage } from '@/lib/storage'

export type Theme = 'system' | 'light' | 'dark'

export const MIN_ZOOM = 0.6
export const MAX_ZOOM = 2.5
export const clampZoom = (z: number) => Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) * 100) / 100

// The key (one field: a write key also reads), who it belongs to, and this device's
// preferences: zoom (the song's font size), colours, the list's order, the chord display.
export type ChordStyle = 'plain' | 'detailed' | 'jazz'

export const useSettings = defineStore('settings', () => {
  const key = ref(storage.get('markflat.key') ?? '')
  // who the key belongs to, remembered so the app knows offline too
  const me = ref<Me | null>(readMe())
  const zoom = ref(clampZoom(Number(storage.get('markflat.zoom')) || 1))
  const theme = ref<Theme>(pick(storage.get('markflat.theme'), ['system', 'light', 'dark'], 'system'))
  const sortBy = ref<'title' | 'artist'>(pick(storage.get('markflat.sort'), ['title', 'artist'], 'title'))
  const unicode = ref(storage.get('markflat.unicode') !== '0')
  // charts: a bar's only chord in its middle
  const centered = ref(storage.get('markflat.centered') === '1')
  // how chords are written: as in the song (a, C7+), spelled out (Am, Cmaj7) or jazz (A–, CΔ7);
  // "detailed" was a switch of its own until chord charts came
  const chords = ref<ChordStyle>(pick(storage.get('markflat.chords'), ['plain', 'detailed', 'jazz'], storage.get('markflat.detailed') === '1' ? 'detailed' : 'plain'))
  const api = createApi(() => key.value)

  watch(zoom, z => storage.set('markflat.zoom', String(z)))
  watch(sortBy, s => storage.set('markflat.sort', s))
  watch(unicode, u => storage.set('markflat.unicode', u ? '1' : '0'))
  watch(centered, c => storage.set('markflat.centered', c ? '1' : '0'))
  watch(chords, c => storage.set('markflat.chords', c))
  watchEffect(() => {
    storage.set('markflat.theme', theme.value)
    if (theme.value === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme.value)
  })

  function setKey(value: string) {
    key.value = value.trim()
    storage.set('markflat.key', key.value)
    me.value = null
    storage.remove('markflat.me')
  }

  /** Asks the server whose key it is; throws ApiError (401 for a wrong key, 0 offline). */
  async function checkKey(): Promise<Me> {
    const asked = key.value
    const who = await api.me()
    if (asked !== key.value) return who // the key changed meanwhile
    me.value = who
    storage.set('markflat.me', JSON.stringify(who))
    return who
  }

  const setZoom = (z: number) => { zoom.value = clampZoom(z) }

  return { key, me, zoom, theme, sortBy, unicode, centered, chords, api, setKey, checkKey, setZoom }
})

function readMe(): Me | null {
  try {
    const me = JSON.parse(storage.get('markflat.me') ?? 'null') as Me | null
    return me && typeof me.canWrite === 'boolean' ? me : null
  } catch {
    return null
  }
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}
