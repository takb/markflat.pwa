<script setup lang="ts">
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'reka-ui'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from '@lucide/vue'
import { useToast, type Severity } from '@/stores/toast'

const toast = useToast()
const icons = { success: CircleCheck, info: Info, warn: TriangleAlert, error: CircleAlert }
const colours: Record<Severity, string> = { success: 'text-success', info: 'text-accent', warn: 'text-warn', error: 'text-danger' }
</script>

<template>
  <ToastProvider swipe-direction="right">
    <ToastRoot
      v-for="t in toast.toasts"
      :key="t.id"
      :duration="t.life"
      :type="t.severity === 'error' ? 'foreground' : 'background'"
      class="toast flex items-start gap-3 rounded-lg border border-line bg-bg p-3 shadow-lg"
      :data-severity="t.severity"
      @update:open="open => { if (!open) toast.remove(t.id) }"
    >
      <component :is="icons[t.severity]" :size="20" class="mt-0.5 shrink-0" :class="colours[t.severity]" />
      <div class="min-w-0 flex-1">
        <ToastTitle class="text-sm font-semibold">{{ t.summary }}</ToastTitle>
        <ToastDescription v-if="t.detail" class="text-sm text-muted">{{ t.detail }}</ToastDescription>
      </div>
      <ToastClose class="btn btn-ghost btn-icon -my-1 -mr-1 h-7 w-7" aria-label="Close"><X :size="16" /></ToastClose>
    </ToastRoot>
    <ToastViewport class="fixed bottom-14 right-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] outline-none" />
  </ToastProvider>
</template>

<style scoped>
.toast[data-state='open'] {
  animation: toast-in 150ms ease-out;
}
.toast[data-swipe='move'] {
  transform: translateX(var(--reka-toast-swipe-move-x));
}
.toast[data-swipe='end'] {
  animation: toast-out 100ms ease-out;
}
@keyframes toast-in {
  from { transform: translateY(0.5rem); opacity: 0; }
}
@keyframes toast-out {
  to { transform: translateX(100%); opacity: 0; }
}
</style>
