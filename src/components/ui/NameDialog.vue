<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AppDialog from './AppDialog.vue'

// Asks for a name (a new set list, renaming one).
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ title: string, initial?: string, confirm: string }>()
const emit = defineEmits<{ done: [name: string] }>()
const name = ref('')
const input = ref<HTMLInputElement>()

watch(open, o => {
  if (!o) return
  name.value = props.initial ?? ''
  nextTick(() => input.value?.select())
})

function submit() {
  if (!name.value.trim()) return
  open.value = false
  emit('done', name.value.trim())
}
</script>

<template>
  <AppDialog v-model:open="open" :title="title">
    <label for="nameInput" class="mb-1 block text-sm font-semibold">Name</label>
    <input id="nameInput" ref="input" v-model="name" class="input" autocomplete="off" placeholder="e.g. Gig Wohnzimmerkonzert 12.12." @keydown.enter="submit">
    <template #actions>
      <button type="button" class="btn btn-secondary" @click="open = false">Cancel</button>
      <button type="button" class="btn btn-primary" :disabled="!name.trim()" @click="submit">{{ confirm }}</button>
    </template>
  </AppDialog>
</template>
