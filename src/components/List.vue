<script setup lang="ts">
    import { ref, computed } from 'vue'
    import { FilterMatchMode } from '@primevue/core/api'
    import { useToast } from 'primevue/usetoast'
    import DataTable, { type DataTableRowClickEvent } from 'primevue/datatable'
    import Column from 'primevue/column'
    import Button from 'primevue/button'
    import Dialog from 'primevue/dialog'
    import InputText from 'primevue/inputtext'
    import IconField from 'primevue/iconfield'
    import InputIcon from 'primevue/inputicon'
    import Menu from 'primevue/menu'
    import type { MenuItem } from 'primevue/menuitem'

    import { ApiError } from '@/api/client'
    import { useSettings } from '@/stores/settings'
    import { useSongbook } from '@/stores/songbook'
    import { useUi } from '@/stores/ui'
    import useSizes from '../composables/sizes.ts'

    const toast = useToast()
    const settings = useSettings()
    const songbook = useSongbook()
    const ui = useUi()
    const filters = ref({ global: { value: null, matchMode: FilterMatchMode.CONTAINS } })
    const menu = ref()
    const settingsOpen = ref(false)
    const keyInput = ref('')
    const keyStatus = ref('')
    const sizes = useSizes()
    const panelCss = computed(() => {
      return sizes.isMobile.value ? 'h-full w-full' : 'h-full w-8/12 ml-auto mr-auto'
    })
    const toggle = (event: Event) => {
      menu.value.toggle(event)
    }
    const viewSong = (event: DataTableRowClickEvent) => {
      ui.show(event.data.slug)
    }
    const fail = (summary: string, e: unknown) => {
      const detail = e instanceof ApiError
        ? (e.status === 401 ? 'The key was not accepted. Check it in the settings.' : e.message)
        : String(e)
      toast.add({ severity: 'error', summary, detail, life: 5000 })
    }

    async function download() {
      try {
        const r = await songbook.sync()
        const parts = [r.added && r.added + ' new', r.updated && r.updated + ' updated', r.removed && r.removed + ' removed'].filter(Boolean)
        toast.add({
          severity: 'success',
          summary: 'Songbook downloaded',
          detail: (parts.length ? parts.join(', ') : 'Everything was up to date') + '.'
            + (r.pending ? ' ' + r.pending + ' song(s) changed here are not uploaded yet.' : '')
            + (r.conflicts.length ? ' ' + r.conflicts.length + ' changed on both sides.' : ''),
          life: 5000,
        })
      } catch (e) {
        fail('Download failed', e)
      }
    }

    async function upload() {
      try {
        const r = await songbook.uploadPending()
        const left = songbook.pending.length
        toast.add({
          severity: left ? 'warn' : 'success',
          summary: 'Upload',
          detail: r.saved + ' uploaded.' + (left ? ' ' + left + ' still waiting (offline, or changed on both sides).' : ''),
          life: 5000,
        })
      } catch (e) {
        fail('Upload failed', e)
      }
    }

    function openSettings() {
      keyInput.value = settings.key
      keyStatus.value = describe()
      settingsOpen.value = true
    }

    function describe(): string {
      const me = settings.me
      if (!me) return ''
      return me.isAdmin ? 'Writes as ' + me.writer + ' (admin)' : me.writer ? 'Writes as ' + me.writer : 'Reads only'
    }

    async function saveKey() {
      settings.setKey(keyInput.value)
      try {
        await settings.checkKey()
        keyStatus.value = describe()
        toast.add({ severity: 'success', summary: 'Key saved', detail: keyStatus.value + '.', life: 3000 })
        settingsOpen.value = false
      } catch (e) {
        keyStatus.value = e instanceof ApiError && e.status === 401 ? 'This key is not valid.' : 'Could not check the key (offline?). It is saved.'
      }
    }

    const items = computed<MenuItem[]>(() => [
      { label: ui.editMode ? 'Leave edit mode' : 'Edit mode', icon: 'pi pi-pencil', command: () => { ui.editMode = !ui.editMode } },
      { label: 'Settings', icon: 'pi pi-cog', command: openSettings },
      { label: 'Download songbook', icon: 'pi pi-download', command: download },
      { label: 'Upload changes (' + songbook.pending.length + ')', icon: 'pi pi-upload', visible: songbook.pending.length > 0 && settings.me?.canWrite !== false, command: upload },
      { label: 'Keys', icon: 'pi pi-key', visible: settings.me?.isAdmin === true, command: () => ui.keys() },
    ])

    // Who the key belongs to (for the menu); quietly, the app works offline too.
    if (settings.key && !settings.me) settings.checkKey().catch(() => {})
</script>

<template>
  <div>
    <DataTable v-model:filters="filters" :value="songbook.list" :global-filter-fields="['title', 'artist', 'content']" sort-field="title" :sort-order="1" :class="panelCss" scrollable scroll-height="flex" striped-rows removable-sort data-key="slug" @row-click="viewSong">
        <template #header>
            <div class="flex justify-between">
              <Button type="button" icon="pi pi-ellipsis-v" aria-label="Menu" aria-haspopup="true" aria-controls="overlay_menu" @click="toggle" />
              <Menu id="overlay_menu" ref="menu" :model="items" :popup="true" />
              <IconField>
                  <InputIcon>
                      <i class="pi pi-search" />
                  </InputIcon>
                  <InputText v-model="filters['global'].value" placeholder="Keyword Search" />
              </IconField>
            </div>
        </template>
        <template #empty> No songs yet: enter your key in the settings, then download the songbook. </template>
        <Column field="title" header="Title" class="p-2 flex-grow" sortable>
            <template #body="{ data }">
              {{ data.title || data.slug }}
              <span v-if="songbook.changed(data.slug)" class="pending" title="Changed here, not uploaded yet">●</span>
            </template>
        </Column>
        <Column field="artist" header="Composer/Interpret" sortable />
        <Column v-if="ui.editMode">
            <template #header>
              <Button icon="pi pi-plus" rounded raised class="mr-2" aria-label="New song" @click="() => ui.edit(songbook.create())" />
            </template>
            <template #body="slotProps">
              <Button icon="pi pi-pencil" rounded raised class="mr-2" aria-label="Edit" @click.stop="() => ui.edit(slotProps.data.slug)" />
            </template>
        </Column>
    </DataTable>
    <Dialog v-model:visible="settingsOpen" modal header="Settings" :style="{ width: '25rem' }">
      <div class="flex items-center gap-4 mb-2">
        <label for="apiKey" class="font-semibold w-16">Key</label>
        <InputText id="apiKey" v-model="keyInput" type="password" class="flex-auto" autocomplete="off" @keydown.enter="saveKey" />
      </div>
      <p class="text-sm mb-6 min-h-5">{{ keyStatus || 'Your read or write key, from the songbook\'s admin.' }}</p>
      <div class="flex justify-end gap-2">
        <Button type="button" label="Cancel" severity="secondary" @click="settingsOpen = false"></Button>
        <Button type="button" label="Save" @click="saveKey"></Button>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.pending {
  color: var(--p-primary-color);
  font-size: 0.7em;
  margin-left: 0.3em;
  vertical-align: middle;
}
</style>
