import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Severity = 'success' | 'info' | 'warn' | 'error'

export interface Toast {
  id: number
  severity: Severity
  summary: string
  detail?: string
  life: number
}

// Short messages after saving, syncing and errors; shown by Toasts.vue (Reka UI Toast).
export const useToast = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let next = 1

  function add(t: { severity: Severity, summary: string, detail?: string, life?: number }) {
    toasts.value.push({ id: next++, life: 4000, ...t })
  }

  function remove(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, add, remove }
})
