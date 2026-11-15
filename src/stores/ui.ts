import { defineStore } from 'pinia'
import { ref } from 'vue'

export type View = 'list' | 'show' | 'edit' | 'keys'

export const useUi = defineStore('ui', () => {
  const view = ref<View>('list')
  const selected = ref<string | null>(null)
  const editMode = ref(false)

  const show = (slug: string) => { selected.value = slug; view.value = 'show' }
  const edit = (slug: string) => { selected.value = slug; view.value = 'edit' }
  const home = () => { view.value = 'list' }
  const keys = () => { view.value = 'keys' }

  return { view, selected, editMode, show, edit, home, keys }
})
