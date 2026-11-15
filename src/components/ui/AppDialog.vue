<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { X } from '@lucide/vue'

// A modal on Reka UI's Dialog: focus trap, Escape, scroll lock. Not closable = a decision the
// user must make (a conflict, a key shown once).
const open = defineModel<boolean>('open', { required: true })
const props = withDefaults(defineProps<{ title: string, closable?: boolean, wide?: boolean }>(), { closable: true, wide: false })
const guard = (e: Event) => { if (!props.closable) e.preventDefault() }
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/50" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-h-[90dvh] overflow-y-auto rounded-xl border border-line bg-bg p-5 text-fg shadow-xl focus:outline-none"
        :class="wide ? 'w-[min(60rem,calc(100vw-1.5rem))]' : 'w-[min(28rem,calc(100vw-1.5rem))]'"
        @escape-key-down="guard"
        @pointer-down-outside="guard"
        @interact-outside="guard"
      >
        <div class="mb-3 flex items-start gap-2">
          <DialogTitle class="flex-1 text-lg font-semibold leading-snug">{{ title }}</DialogTitle>
          <DialogClose v-if="closable" class="btn btn-ghost btn-icon -mr-2 -mt-1" aria-label="Close">
            <X :size="18" />
          </DialogClose>
        </div>
        <DialogDescription as="div">
          <slot />
        </DialogDescription>
        <div v-if="$slots.actions" class="mt-5 flex flex-wrap justify-end gap-2">
          <slot name="actions" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
